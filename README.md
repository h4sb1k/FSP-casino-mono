# FSP Casino — единая платформа мини-игр

**Репозиторий:** [github.com/asCo1oC/fsp-casino-monorepo](https://github.com/asCo1oC/fsp-casino-monorepo)

## Зачем этот проект

Одна точка входа для нескольких мини-игр на **общем бонусном балансе** (баллы на счёте пользователя): регистрация и вход через JWT, резерв баллов при входе в комнату, прозрачный жизненный цикл раунда и серверный выбор победителя. Платформа заточена под сценарий «лобби → комната → ожидание → раунд → выплата», с админ-настройками комнат и глобального конфига.

**Три игры в одном приложении (после сборки в Java `static/`):**

| Игра | Суть | Где в UI |
|------|------|----------|
| **Opencase** | Комнаты с входом, слотами, таймером ожидания (по умолчанию **60 с**), бустом шанса и визуальной рулеткой; исход и таймеры согласованы с бэкендом и WebSocket | `/` |
| **Mountain** | Горный заезд по раундам: ставки в диапазоне комнаты, бусты, события на треке; клиентский геймплей с опорой на тот же кошелёк и авторизацию | `/mountain/` |
| **Bank** | «Взлом сейфа»: подбор комнаты, буст, таймер ожидания перед стартом, визуализация раунда | `/bank/` |

Бэкенд один — **Spring Boot**: кошелёк, комнаты Opencase, STOMP-топики, админ-API. Статические SPA (Opencase + Mountain + Bank) отдаются из `casino-app` вместе с API на порту **8080**.

## Структура монорепозитория

| Каталог | Назначение |
|--------|-------------|
| [`FSP-backend-casino/`](FSP-backend-casino/README.md) | Maven multi-module: домен, игровая логика, Spring Boot-приложение, Flyway, Docker Compose, встроенная статика |
| [`kazik-game/frontend-react/`](kazik-game/frontend-react/README.md) | Исходники **Opencase** (React + Vite); прод-сборка копируется в `static/` бэкенда |
| [`external-games/`](external-games/README.md) | Исходники **Mountain** и **Bank** (Vite); после `npm run build` — отдельно в `static/mountain/` и `static/bank/` |

## Быстрый старт (Docker)

```bash
cd FSP-backend-casino/backend
cp .env.example .env
# Задайте JWT_SECRET ≥ 32 символов

docker compose up --build
```

| URL | Назначение |
|-----|------------|
| http://localhost:8080 | Единое приложение: Opencase, профиль `/profile`, админка `/admin`, вложенные игры |
| http://localhost:8080/mountain/ | Mountain |
| http://localhost:8080/bank/ | Bank |
| http://localhost:8080/swagger-ui | OpenAPI |

Тестовые логины, описание API, WebSocket и Redis: [**FSP-backend-casino/README.md**](FSP-backend-casino/README.md).

## Обновление фронтендов в Java `static/`

**Не** выполняйте `rsync --delete` из корня `dist/` Opencase в корень `static/`, если там уже лежат `mountain/`, `bank/`, `instruct_photos/` — подкаталоги будут удалены.

Рекомендуемый порядок:

1. **Opencase:** `cd kazik-game/frontend-react && npm run build` → скопировать только **`dist/index.html`** и **`dist/assets/`** в `FSP-backend-casino/backend/casino-app/src/main/resources/static/`.
2. **Mountain / Bank:** `npm run build` в `external-games/...` → синхронизировать **только** в `static/mountain/` и `static/bank/`.
3. Пересобрать образ: `docker compose build backend`.

## Локальная разработка Opencase (React)

Сборка и переменные для dev-сервера Vite: [`kazik-game/frontend-react/README.md`](kazik-game/frontend-react/README.md). API и WebSocket в dev обычно проксируются на запущенный бэкенд (**http://localhost:8080**), см. `VITE_*` в `.env.example` пакета.

## Лицензия

См. [LICENSE](LICENSE).
