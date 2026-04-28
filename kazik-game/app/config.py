import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    app_name: str = "Stoloto VIP Opencase"
    debug: bool = Field(default=False, env="DEBUG")
    database_url: str = Field(default="sqlite+aiosqlite:///./vip_opencase.db", env="DATABASE_URL")
    secret_key: str = Field(default="dev-secret-key-change-in-prod", env="SECRET_KEY")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Room defaults
    default_wait_seconds: int = 60
    # Должен совпадать с длительностью анимации рулетки на фронте (сек.)
    opencase_animation_seconds: float = 6.5
    default_max_players: int = 4
    default_entry_fee_min: int = 100
    default_entry_fee_max: int = 5000
    default_prize_pool_pct: float = 0.80
    default_boost_cost_min: int = 50
    default_boost_cost_max: int = 1000
    default_boost_multiplier: float = 0.20
    default_boost_enabled: bool = True

    # Bot policy
    bot_win_policy: str = Field(default="return_pool", env="BOT_WIN_POLICY")  # burn | return_pool

    # RNG
    rng_seed: str | None = Field(default=None, env="RNG_SEED")

    class Config:
        env_file = ".env"

settings = Settings()
