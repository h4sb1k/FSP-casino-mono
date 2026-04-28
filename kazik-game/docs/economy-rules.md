# Экономические правила и формулы

## 1. Понятия

| Термин | Описание |
|--------|---------|
| **entry_fee** | Входной взнос в бонусах, резервируемый при входе в комнату |
| **boost_cost** | Стоимость буста в бонусах |
| **boost_multiplier** | Прибавка к весу участника (например, 0.20 = +20%) |
| **prize_pool_pct** | Доля от общего фонда, идущая в призовой фонд (например, 0.80 = 80%) |
| **total_pool** | Сумма всех взносов и покупок бустов в комнате |
| **prize_pool** | `total_pool * prize_pool_pct` — средства, доступные для выигрыша |
| **promo_pool** | Глобальный пул бонусов, куда возвращаются средства при победе бота (если `bot_win_policy = return_pool`) |

## 2. Алгоритм распределения призового фонда

1. **Резервация при входе**
   - Участник входит → `reserveBonus(user_id, entry_fee)`
   - Бонусы списываются с баланса, статус `reserved`
   - `total_pool += entry_fee`

2. **Покупка буста**
   - Участник может купить буст 1 раз до `LOCKED`
   - `reserveBonus(user_id, boost_cost)`
   - `participant.boost_multiplier = room.boost_multiplier`
   - `total_pool += boost_cost`

3. **Расчет призового фонда**
   ```
   prize_pool = total_pool * prize_pool_pct
   ```

4. **Определение победителя (backend-only)**
   - Вес участника: `weight = 1.0 + boost_multiplier` (если есть буст)
   - Боты: `weight = 1.0` (без бустов, или с бустом если в будущем будет разрешено)
   - RNG (SecureRandom) выбирает победителя по взвешенному пулу

5. **Начисление приза**
   - Если победитель — реальный пользователь:
     ```
     awardAmount = item_value  (берётся из prize_pool)
     updateBalance(winner_id, awardAmount)
     ```
   - Если победитель — бот:
     - При `bot_win_policy = return_pool`:
       ```
       promo_pool += prize_pool
       ```
     - При `bot_win_policy = burn`:
       ```
       (ничего не делается — prize_pool уже учтен в total_pool и не возвращается)
       ```

## 3. Формулы

### 3.1 Общий фонд
```
total_pool = Σ(entry_fee_i) + Σ(boost_cost_j)
```

### 3.2 Призовой фонд
```
prize_pool = total_pool × prize_pool_pct
```

### 3.3 Вес участника
```
weight_i = 1.0 + (boost_multiplier если куплен буст)
```

### 3.4 Вероятность победы
```
P(win_i) = weight_i / Σ(weight_k)  по всем участникам
```

## 4. Risk Validation Rules

См. [`app/services/config_service.py`](app/services/config_service.py:1) — метод `validate_config()`.

### Правило 1: HIGH risk
```
if prize_pool_pct > 0.85 AND boost_cost < entry_fee × 0.2 AND boost_enabled:
    → HIGH
```
**Объяснение**: высокая доля призового фонда + дешёвые бусты создают нестабильную экономику.

### Правило 2: MEDIUM risk
```
if entry_fee > 5000 AND max_players < 4:
    → MEDIUM
```
**Объяснение**: дорогой вход при малом числе игроков снижает привлекательность.

### Правило 3: HIGH risk
```
if boost_multiplier > 0.4:
    → HIGH
```
**Объяснение**: слишком большой бонус к весу нарушает баланс.

### Правило 4: MEDIUM risk
```
if prize_pool_pct < 0.60:
    → MEDIUM
```
**Объяснение**: низкая доля приза снижает мотивацию.

### Правило 5: MEDIUM risk
```
if boost_enabled AND boost_cost > entry_fee × 0.5:
    → MEDIUM
```
**Объяснение**: буст стоит более половины входа — перекос.

## 5. Идемпотентность

Все финансовые операции используют `reference_id` (UUID):
- `reserveBonus` — один `reference_id` на операцию
- `awardPrize` — один `reference_id` на начисление
- `returnToPool` — фиксируется в `promo_pool_ledger` с `round_id`

Повторный запрос с тем же `reference_id` не дублирует транзакцию.

## 6. Аудит

Каждая операция записывается в:
- `bonus_transactions` — все движения бонусов с балансом до/после
- `promo_pool_ledger` — история возвратов от ботов
- `round_results` — полный payload результата раунда (JSONB)
