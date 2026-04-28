from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ParticipantInfo(BaseModel):
    id: int
    user_id: int
    username: str
    display_name: str
    is_bot: bool
    avatar: str
    talisman: str
    seat_index: Optional[int] = None
    boost_multiplier: float
    reserved_amount: int

    class Config:
        from_attributes = True

class RoomBase(BaseModel):
    name: str
    tier: str = Field(default="silver")
    max_players: int = Field(default=4, ge=2, le=10)
    entry_fee: int = Field(default=1000, ge=100, le=5000)
    prize_pool_pct: float = Field(default=0.80, ge=0.5, le=0.95)
    boost_enabled: bool = True
    boost_cost: int = Field(default=200, ge=50, le=1000)
    boost_multiplier: float = Field(default=0.20, ge=0.1, le=0.5)

class RoomCreate(RoomBase):
    pass

class RoomUpdate(BaseModel):
    max_players: Optional[int] = Field(default=None, ge=2, le=10)
    entry_fee: Optional[int] = Field(default=None, ge=100, le=5000)
    prize_pool_pct: Optional[float] = Field(default=None, ge=0.5, le=0.95)
    boost_enabled: Optional[bool] = None
    boost_cost: Optional[int] = Field(default=None, ge=50, le=1000)
    boost_multiplier: Optional[float] = Field(default=None, ge=0.1, le=0.5)

class RoomResponse(RoomBase):
    id: int
    status: str
    total_pool: int
    prize_pool: int
    created_at: datetime
    locked_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RoomDetailResponse(RoomResponse):
    participants_count: int
    bots_count: int
    time_remaining: Optional[int] = None
    participants: List[ParticipantInfo] = Field(default_factory=list)
    active_spin: Optional[dict] = None

class RoomListFilter(BaseModel):
    entry_fee_min: Optional[int] = None
    entry_fee_max: Optional[int] = None
    seats_min: Optional[int] = None
    seats_max: Optional[int] = None
    status: Optional[str] = None

class RoomJoinRequest(BaseModel):
    user_id: int

class RoomJoinResponse(BaseModel):
    room_id: int
    participant_id: int
    reserved_amount: int
    seats_taken: int
    total_pool: int
    message: str


class RoomLeaveRequest(BaseModel):
    user_id: int


class RoomLeaveResponse(BaseModel):
    room_id: int
    total_pool: int
    participants_count: int
    refunded_amount: int
    message: str

class BoostActivateRequest(BaseModel):
    user_id: int

class BoostActivateResponse(BaseModel):
    participant_id: int
    boost_multiplier: float
    cost: int
    message: str
