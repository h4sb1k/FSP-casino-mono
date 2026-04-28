from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import AdminConfig, Room, RoomStatus
from app.schemas.admin import ConfigValidationResponse
from app.config import settings

class ConfigService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_config(self, room_id: int | None = None) -> AdminConfig | None:
        """Get active config for room or global default."""
        query = select(AdminConfig).where(AdminConfig.is_active == True)
        if room_id:
            query = query.where(AdminConfig.room_id == room_id)
        else:
            query = query.where(AdminConfig.room_id.is_(None))
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def validate_config(self, config_data: dict) -> ConfigValidationResponse:
        """
        Risk validation logic from spec p.9.2.
        Returns validation result with risk level and messages.
        """
        warnings = []
        errors = []
        risk = "LOW"

        entry_fee = config_data.get("entry_fee", 0)
        max_players = config_data.get("max_players", 4)
        prize_pool_pct = config_data.get("prize_pool_pct", 0.80)
        boost_cost = config_data.get("boost_cost", 0)
        boost_multiplier = config_data.get("boost_multiplier", 0.20)
        boost_enabled = config_data.get("boost_enabled", True)

        # Rule 1: High prize pool + cheap boost = HIGH risk
        if prize_pool_pct > 0.85 and boost_cost < entry_fee * 0.2 and boost_enabled:
            risk = "HIGH"
            errors.append(
                f"При prize_pool_pct > 85% и boost_cost < 20% от entry_fee система становится нестабильной. "
                f"Текущие значения: prize_pool_pct={prize_pool_pct:.0%}, boost_cost={boost_cost}, entry_fee={entry_fee}"
            )

        # Rule 2: Expensive entry + few players = MEDIUM risk
        if entry_fee > 5000 and max_players < 4:
            risk = max(risk, "MEDIUM")
            warnings.append(
                f"Высокая стоимость входа ({entry_fee}) при малом количестве игроков ({max_players}) снижает привлекательность."
            )

        # Rule 3: Very high boost multiplier = HIGH risk
        if boost_multiplier > 0.4:
            risk = "HIGH"
            errors.append(
                f"Слишком высокий boost_multiplier ({boost_multiplier:.0%}) нарушает баланс. "
                f"Рекомендуется ≤ 40%."
            )

        # Rule 4: Prize pool too low
        if prize_pool_pct < 0.60:
            risk = max(risk, "MEDIUM")
            warnings.append(
                f"Низкий prize_pool_pct ({prize_pool_pct:.0%}) снижает ценность выигрыша для игроков."
            )

        # Rule 5: Boost cost too high relative to entry
        if boost_enabled and boost_cost > entry_fee * 0.5:
            risk = max(risk, "MEDIUM")
            warnings.append(
                f"Boost cost ({boost_cost}) превышает 50% от entry_fee ({entry_fee})."
            )

        # Determine can_save
        can_save = risk != "HIGH" or len(errors) == 0

        explanation = self._get_explanation(risk)

        return ConfigValidationResponse(
            risk_level=risk,
            warnings=warnings,
            errors=errors,
            can_save=can_save,
            explanation=explanation
        )

    def _get_explanation(self, risk: str) -> str:
        explanations = {
            "LOW": "Конфигурация сбалансирована. Безопасно сохранять.",
            "MEDIUM": "Конфигурация имеет потенциальные проблемы. Рекомендуется пересмотреть параметры.",
            "HIGH": "Конфигурация создает нестабильную экономику или несправедливые условия. Сохранение заблокировано."
        }
        return explanations.get(risk, "Неизвестный уровень риска")

    async def create_or_update_config(self, config_data: dict, room_id: int | None = None) -> tuple[AdminConfig, ConfigValidationResponse]:
        """Create or update admin config after validation."""
        validation = await self.validate_config(config_data)

        if not validation.can_save:
            raise ValueError(f"Config validation failed: {validation.errors}")

        existing = await self.db.execute(
            select(AdminConfig).where(AdminConfig.room_id == room_id)
        )
        config = existing.scalar_one_or_none()

        if config:
            # Update
            for key, value in config_data.items():
                if hasattr(config, key):
                    setattr(config, key, value)
            config.risk_level = validation.risk_level
            # SQLite won't auto-populate onupdate when value is explicitly set to NULL.
            config.updated_at = datetime.utcnow()
        else:
            # Create
            config = AdminConfig(
                room_id=room_id,
                max_players=config_data["max_players"],
                entry_fee=config_data["entry_fee"],
                prize_pool_pct=config_data["prize_pool_pct"],
                boost_cost=config_data["boost_cost"],
                boost_enabled=config_data["boost_enabled"],
                boost_multiplier=config_data["boost_multiplier"],
                bot_win_policy=config_data.get("bot_win_policy", "return_pool"),
                risk_level=validation.risk_level
            )
            self.db.add(config)

        await self.db.commit()
        return config, validation
