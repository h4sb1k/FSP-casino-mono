# FSP Casino (backend-модуль)

Сервис игровых комнат и кошелька на баллы: вход в комнату резервирует `entryFee`, опционально покупается буст, по истечении ожидания запускается раунд; победитель определяется **взвешенным RNG на сервере**, выплата идёт через `BalanceService`.

## О продукте в этом репозитории

Здесь собран **основной контур продукта**: REST API, JWT, PostgreSQL, Redis (таймеры и rate limit), STOMP/WebSocket, планировщик раундов и раздача встроенного фронта с **http://localhost:8080** (Opencase + статика Mountain/Bank). Пользовательский сценарий Opencase: лобби → выбор комнаты → `join` → ожидание (таймер, по умолчанию **60 с**) → буст по желанию → розыгрыш → начисление победителю и запись в `round_history`. Админ (`ADMIN`) меняет дефолты создания комнат и параметры существующих комнат в `WAITING`.

Подробнее по API, сокетам и схеме БД см. также [README уровня FSP-backend-casino](../README.md).

---

## Архитектура

Multi-module Maven проект:

```
casino-parent
├── casino-domain   — JPA-сущности, репозитории, enum-ы
├── casino-game     — WinnerService, BalanceService, BotService
└── casino-app      — Spring Boot: контроллеры, security, scheduler, WebSocket
```

Инфраструктура: PostgreSQL 16, Redis 7.

---

## Быстрый старт

### Требования

- Docker и Docker Compose v2

### Запуск

```bash
cp .env.example .env
# Заменить JWT_SECRET в .env на строку ≥ 32 символа

sudo docker compose up --build
```

| Сервис | URL |
|---|---|
| Приложение (SPA + API) | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui |
| Health | http://localhost:8080/actuator/health |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

```bash
sudo docker compose down        # остановить, данные сохраняются
sudo docker compose down -v     # остановить и удалить данные БД
```

---

## Переменные окружения

| Переменная | Описание |
|---|---|
| `POSTGRES_DB` | Имя базы данных |
| `POSTGRES_USER` | Пользователь PostgreSQL |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL |
| `JWT_SECRET` | Секрет подписи JWT (≥ 32 символа) |
| `JWT_EXPIRATION_MS` | Время жизни токена в мс (по умолчанию 86400000) |

---

## Тестовые пользователи

Пароль для всех: **`password`**

| username | vipTier | balance | role |
|---|---|---|---|
| aleksey_m | GOLD | 50 000 | USER |
| vip_player | PLATINUM | 200 000 | ADMIN |
| lucky77 | SILVER | 15 000 | USER |
| new_player | STANDARD | 3 000 | USER |
| pro_gamer | GOLD | 75 000 | USER |

`vip_player` — единственный администратор, имеет доступ к `/api/admin/**`.

При старте создаются 4 тестовые комнаты (STANDARD/SILVER/GOLD/STANDARD).

---

## API Reference

### Публичные эндпоинты (без токена)

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/rooms`, `GET /api/rooms/{id}`
- `GET /swagger-ui/**`, `GET /v3/api-docs/**`
- `GET /actuator/health`
- `WS /ws/**`

### Auth — `/api/auth`

| Метод | Путь | Auth |
|---|---|---|
| POST | `/api/auth/register` | Нет |
| POST | `/api/auth/login` | Нет |
| GET | `/api/auth/me` | JWT |

**POST /api/auth/login** — ответ:
```json
{
  "token": "eyJ...",
  "userId": 1,
  "username": "aleksey_m",
  "vipTier": "GOLD",
  "role": "USER",
  "balance": 50000,
  "reservedBalance": 0
}
```

### Rooms — `/api/rooms`

| Метод | Путь | Auth |
|---|---|---|
| GET | `/api/rooms` | Нет |
| GET | `/api/rooms/{id}` | Нет |
| POST | `/api/rooms` | JWT |
| POST | `/api/rooms/{id}/join` | JWT |
| POST | `/api/rooms/{id}/leave` | JWT |
| POST | `/api/rooms/{id}/boost` | JWT |

**GET /api/rooms** — query-параметры (все опциональны):

| Параметр | Тип | Описание |
|---|---|---|
| `entryFeeMin` | Long | Минимальная стоимость входа |
| `entryFeeMax` | Long | Максимальная стоимость входа |
| `seatsMin` | Integer | Минимум свободных мест |
| `seatsMax` | Integer | Максимум свободных мест |
| `tier` | String | STANDARD / SILVER / GOLD |
| `status` | String | WAITING / RUNNING / FINISHED / CANCELLED |

Без `status` — возвращает WAITING и RUNNING.

**POST /api/rooms/{id}/boost** — ответ:
```json
{
  "winProbability": 0.2857,
  "boostMultiplier": 2.0,
  "boostCost": 50
}
```

Rate limiting: join — 5 попыток за 30 сек, boost — 3 попытки за 60 сек.

### Users — `/api/users`

| Метод | Путь | Auth |
|---|---|---|
| GET | `/api/users/{userId}/profile` | JWT |
| GET | `/api/users/{userId}/active-room` | JWT |

При запросе чужого профиля `balance` и `reservedBalance` возвращаются как `null`.

### History — `/api/history`

| Метод | Путь | Auth |
|---|---|---|
| GET | `/api/history` | JWT |

Query: `limit` (по умолчанию 50, максимум 200), `roomId` (опционально).

### Admin — `/api/admin`

Только для роли `ADMIN`.

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/admin/config` | Текущая конфигурация |
| POST | `/api/admin/config/validate` | Проверить конфигурацию |
| POST | `/api/admin/config` | Сохранить конфигурацию |
| GET | `/api/admin/rooms` | Все комнаты включая FINISHED |
| PUT | `/api/admin/rooms/{id}/config` | Изменить параметры комнаты (только WAITING) |

### Формат ошибок

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "timestamp": "2026-04-22T10:15:30Z"
}
```

| HTTP | code |
|---|---|
| 401 | UNAUTHORIZED |
| 403 | ACCESS_DENIED |
| 404 | ROOM_NOT_FOUND |
| 409 | ROOM_NOT_JOINABLE |
| 422 | INSUFFICIENT_BALANCE |
| 400 | OPERATION_NOT_ALLOWED |
| 500 | INTERNAL_ERROR |

---

## WebSocket

STOMP endpoint: `ws://localhost:8080/ws` (SockJS fallback).

```javascript
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const client = new Client({
  webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
  onConnect: () => {
    client.subscribe('/topic/room/1', (msg) => {
      console.log(JSON.parse(msg.body));
    });
  }
});
client.activate();
```

| Topic | События |
|---|---|
| `/topic/room/{id}` | `PARTICIPANT_UPDATE`, `ROUND_RESULT`, `TIMER_TICK` |
| `/topic/user/{id}` | `BALANCE_UPDATE` |
| `/topic/rooms-list` | `ROOM_CREATED` |

---

## Redis

| Ключ | Назначение | TTL |
|---|---|---|
| `room:timer:{id}` | Таймер ожидания комнаты | `waitingTimerSeconds` |
| `room:lock:{id}` | Distributed lock обработки раунда | 30s |
| `ratelimit:join:{userId}` | Rate limit на вход в комнату | 30s |
| `ratelimit:boost:{userId}` | Rate limit на буст | 60s |
| `cache:rooms:active` | Кэш списка активных комнат | 3s |
| `cache:room:{id}` | Кэш отдельной комнаты | 5s |

---

## Игровая механика

### Цикл раунда

1. `POST /api/rooms/{id}/join` → `entryFee` резервируется на балансе
2. Таймер запускается: `timerStartedAt = NOW()`, TTL сохраняется в Redis
3. Опционально: `POST /api/rooms/{id}/boost` → `balance -= boostCost`, `boosted = true`
4. `RoundScheduler` каждые 5 сек проверяет TTL в Redis; при истечении запускает раунд
5. Свободные места заполняются ботами (`BotService`)
6. Комната → `RUNNING`, победитель определяется взвешенным RNG
7. `BalanceService.settle()` — победитель получает `totalPool × prizePoolPct / 100`
8. Результат сохраняется в `round_history`, комната → `FINISHED`
9. Результат рассылается по WebSocket

### Алгоритм победителя

```
weight = boostMultiplier  если boosted == true
weight = 1.0              иначе

totalWeight = сумма весов всех участников
roll        = random(0, totalWeight)
Победитель  = первый участник, у которого накопленный cursor >= roll
```

Поля `rngRoll` и `rngTotalWeight` сохраняются в `round_history` для верификации.

### Боты

- Заполняют пустые места после истечения таймера
- Имена из пула русских имён + суффикс 10–99: `Борис_42`
- `{ "isBot": true, "botName": "Борис_42", "userId": null }`
- Если бот победил — `payout` остаётся у оператора

### Восстановление после сбоя

При старте `StartupRecoveryService` находит все комнаты в статусе `WAITING`/`RUNNING`, возвращает `entryFee` всем реальным участникам и переводит комнаты в `CANCELLED`.

---

## Схема БД

**`users`** — `id`, `username`, `passwordHash` (BCrypt), `vipTier`, `role`, `balance`, `reservedBalance`

**`rooms`** — `status` (WAITING/RUNNING/FINISHED/CANCELLED), `tier`, `maxSlots`, `entryFee`, `prizePoolPct`, `boostEnabled`, `boostCost`, `boostMultiplier`, `timerStartedAt`, `winnerParticipantId`

**`room_participants`** — `roomId`, `userId` (NULL для ботов), `isBot`, `botName`, `boosted`

**`round_history`** — `winnerIsBot`, `winnerUserId`, `totalPool`, `payout`, `rngSeed`, `rngRoll`, `rngTotalWeight`, `participantCount`, `botCount`

**`admin_config`** — singleton (id=1): `defaultMaxSlots`, `defaultEntryFee`, `defaultPrizePoolPct`, `defaultBoostEnabled`, `defaultBoostCost`, `defaultBoostMultiplier`, `waitingTimerSeconds`

---

## Тесты

```bash
cd backend
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 mvn test
```

**WinnerServiceTest** (5 тестов) — равномерное распределение, буст повышает вероятность, расчёт вероятности.

**BalanceServiceTest** (6 тестов) — reserve/release/deduct/settle, проверка InsufficientBalanceException.

---

## Технический стек

| Компонент | Версия |
|---|---|
| Java | 21 |
| Spring Boot | 3.2.5 |
| PostgreSQL | 16 |
| Redis | 7 |
| JJWT | 0.12.6 |
| SpringDoc OpenAPI | 2.5.0 |
| Flyway | 10.15.2 |
| Lombok | 1.18.32 |
| React | 18 |
| Vite | 5 |
| Tailwind CSS | 3 |
