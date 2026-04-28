# API Contract — Summit Survivor (Production-Fair, Low-Load)

This contract prevents players from predicting winners while keeping backend traffic low.

## Core Model

- Backend is **authoritative** for round outcome.
- Frontend is **render-only** (animation/interpolation).
- Backend sends only **few discrete events** (not per-frame state).
- No full future event script is exposed at round start.

---

## Transport

- HTTP JSON for start/finish endpoints.
- SSE or WebSocket for in-round pushes (recommended WS).
- Auth via existing session/JWT.

---

## 1) Start Round

`POST /api/game/summit/round/start`

### Request

```json
{
  "roomId": "string",
  "selectedBoostId": "helmet | boots | shield | lucky | null",
  "clientRoundNonce": "uuid"
}
```

### Response

```json
{
  "roundId": "string",
  "serverTimeMs": 1735689600000,
  "durationSec": 20,
  "players": [
    { "id": "you", "name": "You", "color": "#ff5f6d", "isUser": true },
    { "id": "alex", "name": "Alex B.", "color": "#4f8bff", "isUser": false }
  ],
  "uiConfig": {
    "baseTrackSpeed": 1,
    "maxMeters": 100
  }
}
```

### Important

- Response does **not** include future hazard targets/timestamps.
- Only static round metadata is returned.

---

## 2) Realtime Round Events (WS/SSE)

Channel example: `game.summit.round.{roundId}`

### 2.1 `round_warning` (short lead only)

```json
{
  "type": "round_warning",
  "roundId": "string",
  "warningType": "avalanche",
  "leadMs": 1200,
  "serverTimeMs": 1735689606400
}
```

### 2.2 `round_event` (apply now)

```json
{
  "type": "round_event",
  "roundId": "string",
  "eventId": "bird-2",
  "eventKind": "bird",
  "targetId": "alex",
  "effect": {
    "heightDelta": -8.5,
    "slowMs": 900
  },
  "serverTimeMs": 1735689607600
}
```

Avalanche example:

```json
{
  "type": "round_event",
  "roundId": "string",
  "eventId": "ava-1",
  "eventKind": "avalanche",
  "zone": { "centerProgress": 0.58, "radius": 0.14 },
  "affected": [
    { "playerId": "you", "heightDelta": -10.2, "slowMs": 1200 },
    { "playerId": "maria", "heightDelta": -7.1, "slowMs": 900 }
  ],
  "serverTimeMs": 1735689608400
}
```

### 2.3 `round_finish` (authoritative result)

```json
{
  "type": "round_finish",
  "roundId": "string",
  "winnerId": "you",
  "finalHeights": [
    { "playerId": "you", "height": 91.2 },
    { "playerId": "alex", "height": 86.4 }
  ],
  "rewardDelta": 540,
  "newBalance": 1040,
  "serverTimeMs": 1735689620000
}
```

---

## 3) Optional HTTP Fallback (No WS/SSE)

If realtime channel is unavailable:

- `GET /api/game/summit/round/{roundId}/events?cursor=...`
- Long-poll every 500–1000ms.
- Same payload schema as realtime events.

---

## 4) Reconnect Endpoint

`GET /api/game/summit/round/{roundId}/state`

```json
{
  "roundId": "string",
  "phase": "running | finished",
  "elapsedMs": 9500,
  "players": [
    { "playerId": "you", "height": 47.2 },
    { "playerId": "alex", "height": 51.1 }
  ],
  "lastEventCursor": 6
}
```

Used only on reconnect/tab restore.

---

## 5) Load Profile

Per 20s round, typical outbound server messages:

- 1 `start` response
- 2 warnings (optional)
- 4–6 hazard events
- 1 finish event

Total: ~8–10 small messages per client per round, no frame streaming.

---

## 6) Error Format

```json
{
  "error": {
    "code": "ROUND_ALREADY_ACTIVE",
    "message": "Round already active for this room."
  }
}
```

Required codes:

- `ROUND_ALREADY_ACTIVE`
- `INSUFFICIENT_BALANCE`
- `ROUND_NOT_FOUND`
- `ROUND_CLOSED`
- `UNAUTHORIZED`

---

## Versioning

- Header: `X-Game-Contract-Version: 2`
- Breaking change => increment version.
