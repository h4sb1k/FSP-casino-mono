from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.models import Round, Room, RoomParticipant, User, RoundResult
from typing import List, Optional

class HistoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_round_history(self, limit: int = 50, room_id: Optional[int] = None) -> List[dict]:
        """Get completed rounds with full details."""
        query = select(Round).where(Round.finished_at.is_not(None)).order_by(desc(Round.finished_at))
        if room_id:
            query = query.where(Round.room_id == room_id)
        query = query.limit(limit)

        rounds = (await self.db.execute(query)).scalars().all()
        result = []

        for r in rounds:
            room = await self.db.get(Room, r.room_id)
            winner_user = await self.db.get(User, r.winner_user_id) if r.winner_user_id else None
            winner_participant = await self.db.get(RoomParticipant, r.winner_participant_id)

            winner_username = "Unknown"
            is_bot = False
            if winner_participant:
                if winner_participant.is_bot:
                    is_bot = True
                    winner_username = f"Bot #{winner_participant.id}"
                elif winner_user:
                    winner_username = winner_user.username

            result.append({
                "round_id": r.id,
                "room_id": r.room_id,
                "room_name": room.name if room else "Unknown",
                "winner_username": winner_username,
                "is_bot": is_bot,
                "item_name": r.item_name,
                "item_rarity": r.item_rarity,
                "item_value": r.item_value,
                "combo_string": r.combo_string,
                "total_pool": room.total_pool if room else 0,
                "prize_pool": room.prize_pool if room else 0,
                "awarded_amount": r.item_value if not is_bot else 0,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None
            })

        return result

    async def get_round_detail(self, round_id: int) -> Optional[dict]:
        """Get single round with full result payload."""
        round_obj = await self.db.get(Round, round_id)
        if not round_obj:
            return None

        room = await self.db.get(Room, round_obj.room_id)
        result = await self.db.get(RoundResult, round_id)

        return {
            "round": round_obj,
            "room": room,
            "result_payload": result.payload if result else None
        }
