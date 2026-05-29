import asyncio
import websockets
import json

# Dictionary to store connected clients by room
# Format: { "room_id": { "host_websocket": ws, "guest_websocket": ws } }
rooms = {}

async def handle_client(websocket):
    try:
        async for message in websocket:
            data = json.loads(message)
            room_id = data.get("room")
            role = data.get("role") # "host" or "guest"
            
            if not room_id:
                continue

            if room_id not in rooms:
                rooms[room_id] = {}

            if data.get("type") == "join":
                rooms[room_id][role] = websocket
                print(f"{role} joined room {room_id}")

                # Notify host that guest joined
                if role == "guest" and "host" in rooms[room_id]:
                    await rooms[room_id]["host"].send(json.dumps({"type": "peer_joined"}))

            elif data.get("type") in ["offer", "answer", "candidate"]:
                # Relay messages to the OTHER peer in the room
                target_role = "guest" if role == "host" else "host"
                if target_role in rooms[room_id]:
                    await rooms[room_id][target_role].send(message)

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        # Cleanup
        for room_id, peers in list(rooms.items()):
            for role, ws in list(peers.items()):
                if ws == websocket:
                    print(f"{role} left room {room_id}")
                    del rooms[room_id][role]
            if not rooms[room_id]:
                del rooms[room_id]

async def main():
    print("Signaling Server running on ws://localhost:8080")
    async with websockets.serve(handle_client, "0.0.0.0", 8080):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
