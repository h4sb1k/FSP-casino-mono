"""
Seed and populate script for Stoloto VIP Opencase.
Creates tiered rooms, demo users, and prefilled bot participants (unique bots per room).
"""
import asyncio
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models.models import AdminConfig, Room, RoomParticipant, RoomStatus, User
from app.room_tiers import resolve_room_tier


ROOM_TEMPLATES = [
    {"name": "Bronze Start", "entry_fee": 250, "max_players": 4, "boost_cost": 50, "boost_multiplier": 0.10},
    {"name": "Bronze Rush", "entry_fee": 400, "max_players": 4, "boost_cost": 75, "boost_multiplier": 0.10},
    {"name": "Silver Arena", "entry_fee": 1000, "max_players": 4, "boost_cost": 150, "boost_multiplier": 0.15},
    {"name": "Silver Grand", "entry_fee": 1400, "max_players": 4, "boost_cost": 175, "boost_multiplier": 0.15},
    {"name": "Gold Prestige", "entry_fee": 2500, "max_players": 4, "boost_cost": 300, "boost_multiplier": 0.20},
    {"name": "Gold Crown", "entry_fee": 3200, "max_players": 4, "boost_cost": 350, "boost_multiplier": 0.20},
    {"name": "Platinum Signature", "entry_fee": 4000, "max_players": 4, "boost_cost": 450, "boost_multiplier": 0.25},
    {"name": "Platinum Royale", "entry_fee": 5000, "max_players": 4, "boost_cost": 500, "boost_multiplier": 0.25},
]


async def seed():
    engine = create_async_engine(settings.database_url, echo=True)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables recreated (schema synced with models)")

    async with AsyncSessionLocal() as db:
        await db.execute(delete(RoomParticipant))
        await db.execute(delete(Room))
        await db.execute(delete(AdminConfig))
        await db.execute(delete(User))
        await db.commit()

        users = [
            User(username="vip_user_1", bonus_balance=12000),
            User(username="vip_user_2", bonus_balance=18000),
            User(username="vip_user_3", bonus_balance=9000),
            User(username="vip_user_4", bonus_balance=22000),
        ]
        db.add_all(users)
        await db.flush()

        rooms = []
        for index, template in enumerate(ROOM_TEMPLATES):
            tier = resolve_room_tier(template["entry_fee"])
            room = Room(
                name=template["name"],
                tier=tier,
                status=RoomStatus.WAITING,
                max_players=template["max_players"],
                entry_fee=template["entry_fee"],
                prize_pool_pct=0.80,
                boost_enabled=True,
                boost_cost=template["boost_cost"],
                boost_multiplier=template["boost_multiplier"],
                total_pool=0,
                prize_pool=0,
            )
            db.add(room)
            await db.flush()

            owner = users[index % len(users)]
            owner_participant = RoomParticipant(
                room_id=room.id,
                user_id=owner.id,
                is_bot=False,
                room_alias=f"P{room.id:02d}{1:05d}"[-8:],
                reserved_amount=room.entry_fee,
                boost_multiplier=0.0,
            )
            db.add(owner_participant)
            room.total_pool += room.entry_fee

            bot_count = 1 if tier == "bronze" else 2 if tier == "silver" else 3
            for b in range(bot_count):
                bot = User(username=f"seed_bot_r{room.id}_{b}", bonus_balance=0)
                db.add(bot)
                await db.flush()
                participant = RoomParticipant(
                    room_id=room.id,
                    user_id=bot.id,
                    is_bot=True,
                    room_alias=f"B{room.id:02d}{(b + 2):05d}"[-8:],
                    reserved_amount=room.entry_fee,
                    boost_multiplier=0.0,
                )
                db.add(participant)
                room.total_pool += room.entry_fee

            room.prize_pool = int(room.total_pool * room.prize_pool_pct)
            rooms.append(room)

        config = AdminConfig(
            room_id=None,
            max_players=4,
            entry_fee=1000,
            prize_pool_pct=0.80,
            boost_cost=200,
            boost_enabled=True,
            boost_multiplier=0.20,
            bot_win_policy="return_pool",
            risk_level="LOW",
        )
        db.add(config)
        await db.commit()

        print("✅ Tiered demo data seeded")
        print("Users created:")
        for user in users:
            print(f"  - {user.username} (id={user.id}, balance={user.bonus_balance})")
        print("Rooms created:")
        for room in rooms:
            print(f"  - {room.name} [{room.tier}] (id={room.id}, pool={room.total_pool})")


if __name__ == "__main__":
    asyncio.run(seed())
