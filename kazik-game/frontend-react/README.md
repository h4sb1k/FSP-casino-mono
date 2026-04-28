# Frontend (React + Vite)

Клиентская часть проекта `Stoloto VIP Opencase`.

## Запуск в режиме разработки

```bash
npm install
npm run dev
```

По умолчанию dev-сервер Vite поднимается отдельно от backend.

## Прод-сборка для backend

Backend раздает статические файлы именно из `frontend-react/dist`, поэтому для интеграции нужен build:

```bash
npm run build
```

После копирования сборки в `casino-app/.../static/` приложение отдаётся Spring Boot на **http://localhost:8080/** (тот же процесс, что и REST API).

## Важный контракт с backend

- HTTP-клиент находится в `src/shared/api/client.ts`.
- Realtime-хук: `src/features/room/hooks/useRoomRealtime.ts`.
- WebSocket события, которые ожидает фронтенд:
  - `TIMER_TICK`
  - `ROOM_LOCKED`
  - `BOTS_ADDED`
  - `PARTICIPANTS_SYNC`
  - `ROUND_RESULT`
  - `ROUND_FINISHED`

## Восстановление рулетки после refresh

При загрузке комнаты клиент использует `GET /api/rooms/{room_id}`.
Если backend вернул `active_spin`, фронтенд обязан восстановить ленту из этого payload, а не генерировать ее локально.

## Структура

- `src/app` — корневой роутинг и layout
- `src/features/lobby` — лобби комнат
- `src/features/room` — игровая комната и рулетка
- `src/features/profile` — личный кабинет
- `src/features/admin` — админ-панель
- `src/features/welcome` — приветственная страница
- `src/styles` — глобальные стили и тема
