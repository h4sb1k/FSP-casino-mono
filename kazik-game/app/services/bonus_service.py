import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.models import User, BonusTransaction, Room, RoomParticipant, Round, PromoPoolLedger
from app.config import settings

class BonusService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def reserve_bonus(self, user_id: int, amount: int, reference_id: str, room_id: int) -> tuple[bool, str]:
        """Idempotent reserve of bonus points for room entry."""
        user = await self.db.get(User, user_id)
        if not user:
            return False, "User not found"

        # Check idempotency
        existing = await self.db.execute(
            select(BonusTransaction).where(
                BonusTransaction.reference_id == reference_id,
                BonusTransaction.user_id == user_id
            )
        )
        if existing.scalar_one_or_none():
            return True, "Already reserved"

        if user.bonus_balance < amount:
            return False, "INSUFFICIENT_BONUS"

        balance_before = user.bonus_balance
        user.bonus_balance -= amount

        tx = BonusTransaction(
            user_id=user_id,
            room_id=room_id,
            type="reserve",
            amount=-amount,
            balance_before=balance_before,
            balance_after=user.bonus_balance,
            reference_id=reference_id,
            tx_metadata={"action": "room_join"}
        )
        self.db.add(tx)
        await self.db.commit()
        return True, "Reserved"

    async def award_prize(self, user_id: int, amount: int, round_id: int, reference_id: str) -> tuple[bool, str]:
        """Award prize to winner."""
        user = await self.db.get(User, user_id)
        if not user:
            return False, "User not found"

        existing = await self.db.execute(
            select(BonusTransaction).where(
                BonusTransaction.reference_id == reference_id
            )
        )
        if existing.scalar_one_or_none():
            return True, "Already awarded"

        balance_before = user.bonus_balance
        user.bonus_balance += amount

        tx = BonusTransaction(
            user_id=user_id,
            room_id=None,
            type="award",
            amount=amount,
            balance_before=balance_before,
            balance_after=user.bonus_balance,
            reference_id=reference_id,
            tx_metadata={"round_id": round_id, "source": "opencase_win"}
        )
        self.db.add(tx)
        await self.db.commit()
        return True, "Awarded"

    async def return_to_pool(self, amount: int, round_id: int, reason: str = "bot_win") -> None:
        """Return unclaimed prize to promo pool when bot wins."""
        ledger = PromoPoolLedger(
            round_id=round_id,
            delta=amount,
            reason=reason,
            snapshot={"total_returned": amount, "timestamp": datetime.utcnow().isoformat()}
        )
        self.db.add(ledger)
        await self.db.commit()

    async def get_balance(self, user_id: int) -> int:
        user = await self.db.get(User, user_id)
        return user.bonus_balance if user else 0

    async def refund_reserve(self, user_id: int, amount: int, room_id: int, reason: str) -> None:
        """Refund reserved bonus when room is cancelled or user leaves before lock."""
        user = await self.db.get(User, user_id)
        if not user:
            return

        balance_before = user.bonus_balance
        user.bonus_balance += amount

        tx = BonusTransaction(
            user_id=user_id,
            room_id=room_id,
            type="refund",
            amount=amount,
            balance_before=balance_before,
            balance_after=user.bonus_balance,
            reference_id=str(uuid.uuid4()),
            tx_metadata={"reason": reason}
        )
        self.db.add(tx)
        await self.db.commit()
