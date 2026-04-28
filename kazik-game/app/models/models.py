import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Enum, JSON, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base

class RoomStatus(str, enum.Enum):
    WAITING = "waiting"
    LOCKED = "locked"
    RUNNING = "running"
    FINISHED = "finished"
    ARCHIVED = "archived"

class UserRole(str, enum.Enum):
    VIP = "vip"
    ADMIN = "admin"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    role = Column(Enum(UserRole), default=UserRole.VIP, nullable=False)
    bonus_balance = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    participations = relationship("RoomParticipant", back_populates="user", cascade="all, delete-orphan")
    boosts = relationship("Boost", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("BonusTransaction", back_populates="user", cascade="all, delete-orphan")

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    tier = Column(String, nullable=False, default="silver", index=True)
    status = Column(Enum(RoomStatus), default=RoomStatus.WAITING, nullable=False, index=True)
    max_players = Column(Integer, nullable=False, default=4)
    entry_fee = Column(Integer, nullable=False)  # in bonus points
    prize_pool_pct = Column(Float, nullable=False, default=0.80)  # 80% of total goes to prize
    boost_enabled = Column(Boolean, default=True, nullable=False)
    boost_cost = Column(Integer, nullable=False, default=100)
    boost_multiplier = Column(Float, nullable=False, default=0.20)  # weight bonus
    total_pool = Column(Integer, default=0, nullable=False)  # sum of entry fees + boosts
    prize_pool = Column(Integer, default=0, nullable=False)  # calculated: total_pool * prize_pool_pct
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    locked_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    # Relationships
    participants = relationship("RoomParticipant", back_populates="room", cascade="all, delete-orphan")
    round = relationship("Round", back_populates="room", uselist=False, cascade="all, delete-orphan")
    config = relationship("AdminConfig", back_populates="room", uselist=False, cascade="all, delete-orphan")

class RoomParticipant(Base):
    __tablename__ = "room_participants"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_bot = Column(Boolean, default=False, nullable=False)
    room_alias = Column(String(8), nullable=False, index=True)  # fixed-length one-time nickname inside room
    seat_index = Column(Integer, nullable=True)  # position in the opencase lane
    reserved_amount = Column(Integer, nullable=False)  # entry fee reserved at join
    boost_multiplier = Column(Float, default=0.0, nullable=False)  # 0.0 if no boost
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    room = relationship("Room", back_populates="participants")
    user = relationship("User", back_populates="participations")
    boost = relationship("Boost", back_populates="participant", uselist=False, cascade="all, delete-orphan")

class Boost(Base):
    __tablename__ = "boosts"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(Integer, ForeignKey("room_participants.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    cost = Column(Integer, nullable=False)  # paid bonus amount
    multiplier = Column(Float, nullable=False)  # e.g. 0.20
    activated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    participant = relationship("RoomParticipant", back_populates="boost")
    user = relationship("User", back_populates="boosts")

class Round(Base):
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    winner_participant_id = Column(Integer, ForeignKey("room_participants.id", ondelete="SET NULL"), nullable=True)
    winner_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    item_id = Column(Integer, nullable=False)
    item_name = Column(String, nullable=False)
    item_rarity = Column(String, nullable=False)  # common|rare|epic|legendary
    item_value = Column(Integer, nullable=False)
    combo_string = Column(String, nullable=False)
    win_index = Column(Integer, nullable=False)  # индекс ячейки в ленте opencase (не индекс участника)
    precomputed_at = Column(DateTime, nullable=False)  # when backend determined winner
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    # Relationships
    room = relationship("Room", back_populates="round")
    result = relationship("RoundResult", back_populates="round", uselist=False, cascade="all, delete-orphan")

class RoundResult(Base):
    __tablename__ = "round_results"

    id = Column(Integer, primary_key=True, index=True)
    round_id = Column(Integer, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    payload = Column(JSON, nullable=False)  # full result snapshot
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    round = relationship("Round", back_populates="result")


class UserRoundHistory(Base):
    __tablename__ = "user_round_history"
    __table_args__ = (
        UniqueConstraint("round_id", "user_id", name="uq_user_round_history_round_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    round_id = Column(Integer, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    username = Column(String, nullable=False)
    room_name = Column(String, nullable=False)
    status = Column(String, nullable=False)  # win|lose
    item_name = Column(String, nullable=False)
    item_rarity = Column(String, nullable=False)
    awarded_amount = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class BonusTransaction(Base):
    __tablename__ = "bonus_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    type = Column(String, nullable=False)  # reserve|award|burn|return_pool
    amount = Column(Integer, nullable=False)
    balance_before = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    reference_id = Column(String, nullable=True)  # idempotency key
    tx_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="transactions")

class PromoPoolLedger(Base):
    __tablename__ = "promo_pool_ledger"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    round_id = Column(Integer, ForeignKey("rounds.id", ondelete="SET NULL"), nullable=True, index=True)
    delta = Column(Integer, nullable=False)  # positive = inflow, negative = outflow
    reason = Column(String, nullable=False)  # bot_win|config_adjustment|other
    snapshot = Column(JSON, nullable=True)  # pool state snapshot
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class AdminConfig(Base):
    __tablename__ = "admin_configs"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=True, unique=True, index=True)
    # null room_id = global default config
    max_players = Column(Integer, nullable=False, default=4)
    entry_fee = Column(Integer, nullable=False, default=1000)
    prize_pool_pct = Column(Float, nullable=False, default=0.80)
    boost_cost = Column(Integer, nullable=False, default=200)
    boost_enabled = Column(Boolean, default=True, nullable=False)
    boost_multiplier = Column(Float, nullable=False, default=0.20)
    bot_win_policy = Column(String, nullable=False, default="return_pool")  # burn|return_pool
    risk_level = Column(String, nullable=False, default="LOW")  # LOW|MEDIUM|HIGH
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    room = relationship("Room", back_populates="config")
