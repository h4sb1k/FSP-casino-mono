import secrets
import math
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Room, RoomParticipant, Round, RoundResult
from app.services.bonus_service import BonusService

class RngService:
    """Deterministic RNG service that selects winner BEFORE animation."""

    def __init__(self, db: AsyncSession, bonus_service: BonusService):
        self.db = db
        self.bonus_service = bonus_service

    async def determine_winner(self, room_id: int) -> Optional[dict]:
        """
        Precompute winner and item for the round.
        Returns dict with winner info and item data, or None if no participants.
        """
        room = await self.db.get(Room, room_id)
        if not room:
            return None

        # Get all participants with their weights
        participants = (await self.db.execute(
            select(RoomParticipant).where(RoomParticipant.room_id == room_id)
        )).scalars().all()

        if not participants:
            return None

        # Build weighted pool
        weights = []
        for p in participants:
            base_weight = 1.0
            if p.boost_multiplier:
                base_weight += p.boost_multiplier
            weights.append(base_weight)

        total_weight = sum(weights)

        # Secure random selection
        r = secrets.randbelow(int(total_weight * 10000)) / 10000.0  # float in [0, total_weight)
        cumulative = 0.0
        winner = None
        winner_index = 0

        for idx, (p, w) in enumerate(zip(participants, weights)):
            cumulative += w
            if r <= cumulative:
                winner = p
                winner_index = idx
                break

        if not winner:
            winner = participants[-1]
            winner_index = len(participants) - 1

        # Generate item data based on rarity pool
        item = self._generate_item(room.total_pool)

        # Индекс остановки рулетки в ленте (не путать с индексом участника)
        lane_items = 80
        lane_margin = 6
        lane_win_index = lane_margin + secrets.randbelow(lane_items - 2 * lane_margin)

        lane_participant_ids = self._build_lane_participant_ids(
            participants=participants,
            winner_participant_id=winner.id,
            lane_items=lane_items,
            win_index=lane_win_index,
        )

        # Create round record
        round_obj = Round(
            room_id=room_id,
            winner_participant_id=winner.id,
            winner_user_id=None if winner.is_bot else winner.user_id,
            item_id=item["id"],
            item_name=item["name"],
            item_rarity=item["rarity"],
            item_value=item["value"],
            combo_string=item["combo"],
            win_index=lane_win_index,
            precomputed_at=room.locked_at or room.started_at
        )
        self.db.add(round_obj)
        await self.db.flush()

        # Store result snapshot
        result_payload = {
            "winner_id": winner.user_id if not winner.is_bot else f"bot_{winner.id}",
            "winner_participant_id": winner.id,
            "winner_is_bot": winner.is_bot,
            "participant_index": winner_index,
            "win_index": lane_win_index,
            "lane_items": lane_items,
            "lane_participant_ids": lane_participant_ids,
            "item": item,
            "room_total_pool": room.total_pool,
            "prize_pool": room.prize_pool,
            "awarded_amount": item["value"] if not winner.is_bot else 0,
            "timestamp": round_obj.precomputed_at.isoformat() if round_obj.precomputed_at else None
        }

        round_result = RoundResult(
            round_id=round_obj.id,
            payload=result_payload
        )
        self.db.add(round_result)
        await self.db.commit()

        return result_payload

    def _build_lane_participant_ids(
        self,
        participants: list[RoomParticipant],
        winner_participant_id: int,
        lane_items: int,
        win_index: int,
    ) -> list[int]:
        participant_ids = [p.id for p in participants]
        if not participant_ids:
            return []

        strip = []
        for _ in range(lane_items):
            random_idx = secrets.randbelow(len(participant_ids))
            strip.append(participant_ids[random_idx])

        if 0 <= win_index < len(strip):
            strip[win_index] = winner_participant_id
        return strip

    def _generate_item(self, total_pool: int) -> dict:
        """Generate a random item based on pool size and rarity weights."""
        # Rarity tiers
        rarities = ["common", "rare", "epic", "legendary"]
        # Base weights - adjust by pool size
        if total_pool < 2000:
            weights = [0.70, 0.25, 0.04, 0.01]
        elif total_pool < 5000:
            weights = [0.60, 0.30, 0.08, 0.02]
        elif total_pool < 10000:
            weights = [0.50, 0.35, 0.12, 0.03]
        else:
            weights = [0.40, 0.35, 0.20, 0.05]

        r = secrets.SystemRandom().random()
        cumulative = 0.0
        selected_rarity = "common"
        for rarity, w in zip(rarities, weights):
            cumulative += w
            if r <= cumulative:
                selected_rarity = rarity
                break

        # Item templates per rarity
        items = {
            "common": [
                {"id": 1, "name": "Смартфон", "value": 500, "combo": "📱 COMMON", "icon": "📱"},
                {"id": 2, "name": "Наушники", "value": 800, "combo": "🎧 COMMON", "icon": "🎧"},
                {"id": 3, "name": "Флешка", "value": 300, "combo": "💾 COMMON", "icon": "💾"},
            ],
            "rare": [
                {"id": 4, "name": "Планшет", "value": 2000, "combo": "📱 RARE", "icon": "📱"},
                {"id": 5, "name": "Умные часы", "value": 2500, "combo": "⌚ RARE", "icon": "⌚"},
                {"id": 6, "name": "Игровая консоль", "value": 3000, "combo": "🎮 RARE", "icon": "🎮"},
            ],
            "epic": [
                {"id": 7, "name": "Ноутбук", "value": 8000, "combo": "💻 EPIC", "icon": "💻"},
                {"id": 8, "name": "Телевизор 4K", "value": 12000, "combo": "📺 EPIC", "icon": "📺"},
                {"id": 9, "name": "Камера Pro", "value": 10000, "combo": "📷 EPIC", "icon": "📷"},
            ],
            "legendary": [
                {"id": 10, "name": "Supercar Key", "value": 50000, "combo": "🔑 LEGENDARY", "icon": "🔑"},
                {"id": 11, "name": "Квартира", "value": 100000, "combo": "🏠 LEGENDARY", "icon": "🏠"},
                {"id": 12, "name": "Яхта", "value": 200000, "combo": "🛥️ LEGENDARY", "icon": "🛥️"},
            ]
        }

        pool = items[selected_rarity]
        picked = secrets.SystemRandom().choice(pool)
        return {**picked, "rarity": selected_rarity}
