import asyncio
import secrets
import string
import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, delete
from app.models.models import (
    Room, RoomStatus, RoomParticipant, User, Boost, Round, AdminConfig, UserRoundHistory, RoundResult
)
from app.services.bonus_service import BonusService
from app.services.rng_service import RngService
from app.config import settings
from app.room_tiers import resolve_room_tier

class RoomsService:
    def __init__(self, db: AsyncSession, bonus_service: BonusService, rng_service: RngService):
        self.db = db
        self.bonus_service = bonus_service
        self.rng_service = rng_service

    async def list_rooms(self, filters: dict) -> List[Room]:
        """List rooms with optional filters."""
        query = select(Room).where(Room.status.in_([RoomStatus.WAITING, RoomStatus.FINISHED]))
        if filters.get("status"):
            query = query.where(Room.status == filters["status"])
        if filters.get("tier"):
            query = query.where(Room.tier == filters["tier"])
        if filters.get("entry_fee_min"):
            query = query.where(Room.entry_fee >= filters["entry_fee_min"])
        if filters.get("entry_fee_max"):
            query = query.where(Room.entry_fee <= filters["entry_fee_max"])
        if filters.get("seats_min"):
            query = query.where(Room.max_players >= filters["seats_min"])
        if filters.get("seats_max"):
            query = query.where(Room.max_players <= filters["seats_max"])
        result = await self.db.execute(query)
        return result.scalars().all()

    async def create_room(self, name: str, creator_id: int | None, config: dict) -> Room:
        """Create a new room with given config."""
        entry_fee = config.get("entry_fee", settings.default_entry_fee_min)
        room = Room(
            name=name,
            tier=config.get("tier") or resolve_room_tier(entry_fee),
            max_players=config.get("max_players", settings.default_max_players),
            entry_fee=entry_fee,
            prize_pool_pct=config.get("prize_pool_pct", settings.default_prize_pool_pct),
            boost_enabled=config.get("boost_enabled", settings.default_boost_enabled),
            boost_cost=config.get("boost_cost", settings.default_boost_cost_min),
            boost_multiplier=config.get("boost_multiplier", settings.default_boost_multiplier),
        )
        self.db.add(room)
        await self.db.flush()

        # Creator auto-joins only for explicitly user-created rooms.
        if creator_id is not None:
            await self._join_room_internal(room.id, creator_id, is_bot=False)
        await self.db.commit()
        return room

    async def join_room(self, room_id: int, user_id: int) -> tuple[RoomParticipant, str]:
        """User joins a waiting room."""
        room = await self.db.get(Room, room_id)
        if not room:
            raise ValueError("Room not found")
        if room.status != RoomStatus.WAITING:
            raise ValueError("Room is not accepting joins")

        existing = (await self.db.execute(
            select(RoomParticipant).where(
                RoomParticipant.room_id == room_id,
                RoomParticipant.user_id == user_id,
                RoomParticipant.is_bot == False
            )
        )).scalar_one_or_none()
        if existing:
            raise ValueError("User already joined this room")

        # Check capacity
        current = (await self.db.execute(
            select(func.count()).select_from(RoomParticipant).where(
                RoomParticipant.room_id == room_id
            )
        )).scalar_one()
        if current >= room.max_players:
            raise ValueError("Room is full")

        # Reserve bonus
        reference_id = str(uuid.uuid4())
        success, msg = await self.bonus_service.reserve_bonus(
            user_id=user_id,
            amount=room.entry_fee,
            reference_id=reference_id,
            room_id=room_id
        )
        if not success:
            raise ValueError(msg)

        participant = await self._join_room_internal(room_id, user_id, is_bot=False)
        await self.db.commit()
        return participant, "Joined successfully"

    async def leave_room(self, room_id: int, user_id: int) -> dict:
        """Allow a user to leave a waiting room and get refunded."""
        room = await self.db.get(Room, room_id)
        if not room:
            raise ValueError("Room not found")
        if room.status not in [RoomStatus.WAITING, RoomStatus.FINISHED]:
            raise ValueError("Cannot leave room after round preparation has started")

        participant = (await self.db.execute(
            select(RoomParticipant).where(
                RoomParticipant.room_id == room_id,
                RoomParticipant.user_id == user_id,
                RoomParticipant.is_bot == False
            )
        )).scalar_one_or_none()
        if not participant:
            raise ValueError("User is not in this room")

        refunded_amount = 0
        if room.status == RoomStatus.WAITING:
            refunded_amount = participant.reserved_amount
            if participant.boost_multiplier > 0:
                refunded_amount += room.boost_cost

            await self.bonus_service.refund_reserve(
                user_id=user_id,
                amount=refunded_amount,
                room_id=room_id,
                reason="room_leave"
            )

        if room.status == RoomStatus.WAITING:
            room.total_pool = max(0, room.total_pool - participant.reserved_amount)
            if participant.boost_multiplier > 0:
                room.total_pool = max(0, room.total_pool - room.boost_cost)
            room.prize_pool = int(room.total_pool * room.prize_pool_pct)

        await self.db.delete(participant)
        await self.db.flush()

        remaining = (await self.db.execute(
            select(func.count()).select_from(RoomParticipant).where(
                RoomParticipant.room_id == room_id
            )
        )).scalar_one()

        await self.db.commit()
        return {
            "room_id": room_id,
            "total_pool": room.total_pool,
            "participants_count": remaining,
            "refunded_amount": refunded_amount,
            "message": "Room is now waiting for players again" if room.status == RoomStatus.WAITING and remaining == 0 else "Left room successfully"
        }

    async def _join_room_internal(self, room_id: int, user_id: int, is_bot: bool = False) -> RoomParticipant:
        """Internal join without bonus reserve (used for creator and bots)."""
        room = await self.db.get(Room, room_id)
        participant = RoomParticipant(
            room_id=room_id,
            user_id=user_id,
            is_bot=is_bot,
            room_alias=await self._generate_room_alias(room_id, is_bot),
            reserved_amount=room.entry_fee,
            boost_multiplier=0.0
        )
        self.db.add(participant)
        await self.db.flush()

        # Update room total pool
        room.total_pool += room.entry_fee
        room.prize_pool = int(room.total_pool * room.prize_pool_pct)
        return participant

    async def _generate_room_alias(self, room_id: int, is_bot: bool) -> str:
        """Generate unique fixed-length alias for a participant within a room."""
        charset = string.ascii_uppercase + string.digits
        prefix = "B" if is_bot else "P"
        suffix_len = 7  # total length = 8
        for _ in range(30):
            suffix = "".join(secrets.choice(charset) for _ in range(suffix_len))
            candidate = f"{prefix}{suffix}"
            exists = (await self.db.execute(
                select(RoomParticipant.id).where(
                    RoomParticipant.room_id == room_id,
                    RoomParticipant.room_alias == candidate
                )
            )).scalar_one_or_none()
            if not exists:
                return candidate
        # Fallback in very unlikely collision storm
        stamp = str(uuid.uuid4()).replace("-", "").upper()[:suffix_len]
        return f"{prefix}{stamp}"

    async def activate_boost(self, room_id: int, user_id: int) -> Boost:
        """User purchases a one-time boost."""
        room = await self.db.get(Room, room_id)
        if not room:
            raise ValueError("Room not found")
        if not room.boost_enabled:
            raise ValueError("Boosts are disabled in this room")

        participant = (await self.db.execute(
            select(RoomParticipant).where(
                RoomParticipant.room_id == room_id,
                RoomParticipant.user_id == user_id,
                RoomParticipant.is_bot == False
            )
        )).scalar_one_or_none()
        if not participant:
            raise ValueError("Not a participant")

        if participant.boost_multiplier > 0:
            raise ValueError("Boost already activated")

        # Deduct boost cost
        reference_id = str(uuid.uuid4())
        success, msg = await self.bonus_service.reserve_bonus(
            user_id=user_id,
            amount=room.boost_cost,
            reference_id=reference_id,
            room_id=room_id
        )
        if not success:
            raise ValueError(msg)

        boost = Boost(
            participant_id=participant.id,
            user_id=user_id,
            cost=room.boost_cost,
            multiplier=room.boost_multiplier
        )
        participant.boost_multiplier = room.boost_multiplier
        self.db.add(boost)
        room.total_pool += room.boost_cost
        room.prize_pool = int(room.total_pool * room.prize_pool_pct)
        await self.db.commit()
        return boost

    async def fill_bots(self, room_id: int) -> int:
        """Fill empty slots with bots until max_players or policy limit."""
        room = await self.db.get(Room, room_id)
        current = (await self.db.execute(
            select(func.count()).select_from(RoomParticipant).where(
                RoomParticipant.room_id == room_id
            )
        )).scalar_one()

        bots_to_add = max(0, room.max_players - current)
        bot_count = 0
        for i in range(bots_to_add):
            bot_username = self._generate_bot_username(room_id, i)
            bot_user = User(
                username=bot_username,
                role="vip",
                bonus_balance=0
            )
            self.db.add(bot_user)
            await self.db.flush()
            await self._join_room_internal(room_id, bot_user.id, is_bot=True)
            bot_count += 1

        await self.db.commit()
        return bot_count

    async def count_real_players(self, room_id: int) -> int:
        return (await self.db.execute(
            select(func.count()).select_from(RoomParticipant).where(
                RoomParticipant.room_id == room_id,
                RoomParticipant.is_bot == False
            )
        )).scalar_one()

    async def delete_room_and_bot_users(self, room_id: int) -> None:
        bot_user_ids = (await self.db.execute(
            select(RoomParticipant.user_id).where(
                RoomParticipant.room_id == room_id,
                RoomParticipant.is_bot == True
            )
        )).scalars().all()
        room = await self.db.get(Room, room_id)
        if room:
            await self.db.delete(room)
            await self.db.flush()
        if bot_user_ids:
            await self.db.execute(delete(User).where(User.id.in_(bot_user_ids)))
        await self.db.commit()

    async def lock_room(self, room_id: int) -> bool:
        """Lock room and precompute winner."""
        room = await self.db.get(Room, room_id)
        if not room or room.status != RoomStatus.WAITING:
            return False

        room.status = RoomStatus.LOCKED
        room.locked_at = datetime.utcnow()
        await self.db.commit()
        return True

    async def start_round(self, room_id: int) -> dict:
        """Start the round and return precomputed result."""
        room = await self.db.get(Room, room_id)
        if not room:
            raise ValueError("Room not found")

        room.status = RoomStatus.RUNNING
        room.started_at = datetime.utcnow()
        await self.db.commit()

        # Precompute winner
        result = await self.rng_service.determine_winner(room_id)
        return result or {}

    async def finish_round(self, room_id: int) -> Round:
        """Finalize round: award prize or return to pool."""
        room = await self.db.get(Room, room_id)
        round_obj = (await self.db.execute(
            select(Round).where(Round.room_id == room_id)
        )).scalar_one_or_none()
        if not round_obj:
            raise ValueError("Round not found")

        # Get config for bot policy
        config = (await self.db.execute(
            select(AdminConfig).where(AdminConfig.room_id == room_id)
        )).scalar_one_or_none()
        policy = config.bot_win_policy if config else settings.bot_win_policy
        room_participants = (await self.db.execute(
            select(RoomParticipant).where(
                RoomParticipant.room_id == room_id,
                RoomParticipant.is_bot == False,
            )
        )).scalars().all()

        if round_obj.winner_user_id:
            # Real user wins
            await self.bonus_service.award_prize(
                user_id=round_obj.winner_user_id,
                amount=round_obj.item_value,
                round_id=round_obj.id,
                reference_id=str(uuid.uuid4())
            )
        else:
            # Bot wins
            if policy == "return_pool":
                await self.bonus_service.return_to_pool(
                    amount=room.prize_pool,
                    round_id=round_obj.id,
                    reason="bot_win"
                )
            # If burn policy, do nothing - funds already in room.prize_pool are effectively removed

        existing_history = (await self.db.execute(
            select(UserRoundHistory.id).where(UserRoundHistory.round_id == round_obj.id)
        )).first()
        if not existing_history:
            for participant in room_participants:
                user = await self.db.get(User, participant.user_id)
                if not user:
                    continue
                is_win = round_obj.winner_user_id == participant.user_id
                self.db.add(UserRoundHistory(
                    round_id=round_obj.id,
                    room_id=room.id if room else None,
                    user_id=participant.user_id,
                    username=user.username,
                    room_name=room.name if room else f"Room #{room_id}",
                    status="win" if is_win else "lose",
                    item_name=round_obj.item_name,
                    item_rarity=round_obj.item_rarity,
                    awarded_amount=round_obj.item_value if is_win else 0,
                ))

        room.status = RoomStatus.FINISHED
        room.finished_at = datetime.utcnow()
        await self.db.commit()
        return round_obj

    async def get_room_with_participants(self, room_id: int) -> Optional[dict]:
        """Get room details with participant info."""
        room = await self.db.get(Room, room_id)
        if not room:
            return None

        participants = (await self.db.execute(
            select(RoomParticipant).where(RoomParticipant.room_id == room_id)
        )).scalars().all()

        participant_details = []
        for p in participants:
            user = await self.db.get(User, p.user_id)
            avatar = self._resolve_talisman(p.user_id, p.is_bot)
            username = user.username if user else f"bot_{p.id}"
            participant_details.append({
                "id": p.id,
                "user_id": p.user_id,
                "username": username,
                "display_name": username,
                "is_bot": p.is_bot,
                "avatar": avatar,
                "talisman": avatar,
                "seat_index": p.seat_index,
                "boost_multiplier": p.boost_multiplier,
                "reserved_amount": p.reserved_amount
            })

        active_spin = None
        if room.status == RoomStatus.RUNNING:
            round_obj = (await self.db.execute(select(Round).where(Round.room_id == room_id))).scalar_one_or_none()
            if round_obj:
                round_result = (await self.db.execute(select(RoundResult).where(RoundResult.round_id == round_obj.id))).scalar_one_or_none()
                if round_result:
                    active_spin = round_result.payload

        return {
            "room": room,
            "participants": participant_details,
            "active_spin": active_spin
        }

    async def get_active_room_for_user(self, user_id: int) -> Optional[int]:
        room_id = (await self.db.execute(
            select(RoomParticipant.room_id)
            .join(Room, Room.id == RoomParticipant.room_id)
            .where(
                RoomParticipant.user_id == user_id,
                RoomParticipant.is_bot == False,
                Room.status.in_([RoomStatus.WAITING, RoomStatus.LOCKED, RoomStatus.RUNNING, RoomStatus.FINISHED])
            )
            .order_by(RoomParticipant.joined_at.desc())
            .limit(1)
        )).scalar_one_or_none()
        return room_id

    def _resolve_talisman(self, user_id: int, is_bot: bool) -> str:
        pool = ["🦊", "🐯", "🦁", "🐼", "🦉", "🐺", "🐸", "🦄", "🐙", "🐢", "🦅", "🐨", "🐵", "🐧", "🦝", "🐱"]
        return pool[user_id % len(pool)]

    def _generate_bot_username(self, room_id: int, idx: int) -> str:
        adjectives = ["Шустрый", "Лютый", "Тихий", "Рыжий", "Пушистый", "Смелый", "Хитрый", "Крепкий"]
        creatures = ["Енот", "Барс", "Лис", "Пингвин", "Дракон", "Филин", "Краб", "Кот"]
        adjective = adjectives[(room_id + idx) % len(adjectives)]
        creature = creatures[(room_id * 3 + idx) % len(creatures)]
        suffix = f"{(room_id + idx) % 100:02d}"
        return f"{adjective}{creature}{suffix}"
