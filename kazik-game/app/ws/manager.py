import json
import asyncio
from typing import Dict, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect
from app.models.models import Room, RoomStatus

class ConnectionManager:
    """Manages WebSocket connections per room and broadcasts."""

    def __init__(self):
        # room_id -> set of WebSocket connections
        self.rooms: Dict[int, Set[WebSocket]] = {}
        # user_id -> WebSocket (for direct messages)
        self.user_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, room_id: int, user_id: int):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(websocket)
        self.user_connections[user_id] = websocket

    def disconnect(self, websocket: WebSocket, room_id: int, user_id: int):
        if room_id in self.rooms and websocket in self.rooms[room_id]:
            self.rooms[room_id].remove(websocket)
            if not self.rooms[room_id]:
                del self.rooms[room_id]
        if user_id in self.user_connections:
            del self.user_connections[user_id]

    async def broadcast_to_room(self, room_id: int, event: str, data: dict):
        """Send event to all connections in a room."""
        if room_id not in self.rooms:
            return
        message = json.dumps({"event": event, "data": data})
        dead_connections = []
        for ws in self.rooms[room_id]:
            try:
                await ws.send_text(message)
            except Exception:
                dead_connections.append(ws)

        for ws in dead_connections:
            self.rooms[room_id].remove(ws)

    async def send_to_user(self, user_id: int, event: str, data: dict):
        """Send direct message to a specific user."""
        if user_id in self.user_connections:
            ws = self.user_connections[user_id]
            try:
                await ws.send_text(json.dumps({"event": event, "data": data}))
            except Exception:
                pass

# Global manager instance
manager = ConnectionManager()
