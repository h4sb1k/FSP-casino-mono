# Stoloto Mini-Games Platform — Opencase Module

![Приветственная страница](docs/images/welcome-page.png)

Текущий репозиторий содержит мини-игру `Opencase` — первую из трех мини-игр, которые будут объединены в единый игровой проект.

## Стек

- Backend: Java 21 + Spring Boot (`FSP-backend-casino`)
- Database: PostgreSQL + Redis
- Frontend: React + Vite
- Realtime: STOMP/SockJS (`/ws`)

## Быстрый старт

### 1) Запуск Java backend

```bash
cd ../FSP-backend-casino
cp .env.example .env
# заполнить JWT_SECRET (>= 32 символа)
docker compose up --build
```

### 2) Настройка frontend

```bash
cd ../kazik-game/frontend-react
cp .env.example .env
```

По умолчанию фронтенд подключается к `http://localhost:8080` и логинится тестовым пользователем:
- `VITE_AUTH_USERNAME=aleksey_m`
- `VITE_AUTH_PASSWORD=password`

### 3) Запуск frontend

```bash
npm install
npm run dev
```

### 4) Открыть приложение

- Лобби: `http://localhost:5173/`
- Профиль: `http://localhost:5173/profile`
- Админка: `http://localhost:5173/admin`

## Интеграция без сюрпризов

- Источник истины — Java backend из `FSP-backend-casino`.
- Frontend использует adapter-слой: Java DTO/WS payload нормализуются в старые модели UI.
- Авторизация: JWT через `POST /api/auth/login`, токен хранится в `localStorage` (`casino_jwt`).
- Realtime: подписка на `/topic/room/{roomId}` через STOMP/SockJS endpoint `/ws`.
- Поддерживаются env-переменные в `frontend-react/.env`:
  - `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`, `VITE_API_PROXY_TARGET`,
  - `VITE_AUTH_USERNAME`, `VITE_AUTH_PASSWORD`.

## Что реализовано

- Лобби с фильтрами, созданием комнат и входом.
- Комната с realtime-обновлением участников.
- Сервер-авторитетная рулетка:
  - победитель и лента считаются на backend,
  - frontend только визуализирует `winIndex` и `laneStrip`.
- Буст шанса:
  - покупка 1 раз на участника,
  - визуальные эффекты для boosted-пользователя.
- Аватары и имена:
  - реальные игроки отображаются по `username`,
  - боты получают псевдослучайные имена,
  - аватары используются в комнате, рулетке и профиле.
- Профиль пользователя:
  - баланс,
  - количество игр/побед,
  - история раундов.
- Эффекты победы:
  - count-up баланса,
  - overlay победителя,
  - rain эффект монет.
- Админка:
  - глобальный шаблон для будущих комнат,
  - редактирование конкретных комнат в статусе `WAITING`.

## Админ-панель

В админке есть 2 независимых блока:

1. **Редактирование конкретных комнат**
   - источник: `GET /api/admin/rooms`
   - сохранение: `PUT /api/admin/rooms/{room_id}/config`
   - ограничение: редактируются только комнаты `WAITING`
2. **Шаблон для новых комнат**
   - источник: `GET /api/admin/config`
   - сохранение: `POST /api/admin/config`
   - применяется к новым комнатам, которые создаются после удаления старых.

## API (актуально, Java backend)

- `GET /api/rooms` - фильтры: `entryFeeMin`, `entryFeeMax`, `seatsMin`, `seatsMax`, `tier`, `status`
- `GET /api/rooms/{room_id}` - детали комнаты
- `POST /api/rooms` - создать комнату
- `POST /api/rooms/{room_id}/join` - вход
- `POST /api/rooms/{room_id}/leave` - выход
- `POST /api/rooms/{room_id}/boost` - купить буст
- `GET /api/users/{user_id}/active-room`
- `GET /api/users/{user_id}/profile?limit=20`
- `GET /api/admin/config`
- `POST /api/admin/config/validate`
- `POST /api/admin/config`
- `GET /api/admin/rooms`
- `PUT /api/admin/rooms/{room_id}/config`
- `GET /api/history?limit=50&room_id={id}`

## WebSocket

URL:

```text
http://localhost:8080/ws
```

Топик комнаты:

- `/topic/room/{room_id}`

События:

- `TIMER_TICK`
- `PARTICIPANT_UPDATE`
- `ROUND_RESULT`

### Полезные payload-поля для интеграции

- `TIMER_TICK.secondsRemaining`: обратный отсчет комнаты до старта.
- `PARTICIPANT_UPDATE.participants[]`: актуальный состав участников.
- `ROUND_RESULT.winnerParticipantId`: id победителя раунда.
- `ROUND_RESULT.payout`: сумма выплаты.

## Важные замечания по рулетке

- Источник истины - backend.
- Frontend не вычисляет победителя.
- Визуальные эффекты финиша синхронизированы с фактическим окончанием анимации ленты.
- Длительность спина регулируется в `frontend-react/src/features/room/components/CaseRoulette.tsx`:
  - `MAIN_SPIN_MS`
  - `SETTLE_MS`
  - `slowdownLeadMs` (момент включения тряски до остановки)

## Структура проекта

```text
app/
  main.py
  models/models.py
  schemas/
  services/
  ws/manager.py

frontend-react/
  src/
    app/
    features/
      admin/
      lobby/
      profile/
      room/
```

## Статус

Модуль `Opencase` готов к локальной демонстрации и интеграции как часть будущей мульти-игровой платформы.
