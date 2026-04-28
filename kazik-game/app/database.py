import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base
from app.config import settings

# SQLite async engine
engine = create_async_engine(
    settings.database_url,
    connect_args={"timeout": 30},
    echo=settings.debug,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

Base = declarative_base()

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    max_retries = 5
    for attempt in range(1, max_retries + 1):
        try:
            async with engine.begin() as conn:
                if engine.dialect.name == "sqlite":
                    # WAL + busy timeout reduce lock contention for concurrent readers/writers.
                    await conn.execute(text("PRAGMA journal_mode=WAL"))
                    await conn.execute(text("PRAGMA synchronous=NORMAL"))
                    await conn.execute(text("PRAGMA busy_timeout=30000"))

                await conn.run_sync(Base.metadata.create_all)
                # Lightweight runtime migration for existing SQLite DBs.
                # Adds room_alias if database was created before this field existed.
                if engine.dialect.name == "sqlite":
                    table_info = await conn.execute(text("PRAGMA table_info(room_participants)"))
                    columns = {row[1] for row in table_info.fetchall()}
                    if "room_alias" not in columns:
                        await conn.execute(
                            text("ALTER TABLE room_participants ADD COLUMN room_alias VARCHAR(8)")
                        )
                        await conn.execute(
                            text(
                                "UPDATE room_participants "
                                "SET room_alias = CASE "
                                "WHEN is_bot = 1 THEN ('B' || substr('0000000' || id, -7, 7)) "
                                "ELSE ('P' || substr('0000000' || id, -7, 7)) "
                                "END "
                                "WHERE room_alias IS NULL"
                            )
                        )
            return
        except OperationalError as exc:
            is_locked = "database is locked" in str(exc).lower()
            if not is_locked or attempt == max_retries:
                raise
            await asyncio.sleep(min(2 * attempt, 8))
