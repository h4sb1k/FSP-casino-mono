from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class AdminConfigBase(BaseModel):
    max_players: int = Field(default=4, ge=2, le=10)
    entry_fee: int = Field(default=1000, ge=100, le=5000)
    prize_pool_pct: float = Field(default=0.80, ge=0.5, le=0.95)
    boost_cost: int = Field(default=200, ge=50, le=1000)
    boost_enabled: bool = True
    boost_multiplier: float = Field(default=0.20, ge=0.1, le=0.5)
    bot_win_policy: str = Field(default="return_pool", pattern="^(burn|return_pool)$")

class AdminConfigCreate(AdminConfigBase):
    room_id: Optional[int] = None  # null = global default

class AdminConfigUpdate(AdminConfigBase):
    pass

class AdminConfigResponse(AdminConfigBase):
    id: int
    room_id: Optional[int]
    risk_level: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ConfigValidationResponse(BaseModel):
    risk_level: str  # LOW|MEDIUM|HIGH
    warnings: list[str] = []
    errors: list[str] = []
    can_save: bool
    explanation: str

class HistoryEntry(BaseModel):
    round_id: int
    room_id: int
    room_name: str
    winner_username: str
    is_bot: bool
    item_name: str
    item_rarity: str
    item_value: int
    combo_string: str
    total_pool: int
    prize_pool: int
    awarded_amount: int
    finished_at: str

    class Config:
        from_attributes = True
