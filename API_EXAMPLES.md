# API Examples

## Auth

### Register
```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "status": "offline"
  }
}
```

### Login
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Get Profile
```bash
curl -X GET http://localhost:8080/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

## Rooms

### List Rooms
```bash
curl -X GET http://localhost:8080/rooms
```

### Create Room
```bash
curl -X POST http://localhost:8080/rooms \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Room","type":"private"}'
```

### Get Room
```bash
curl -X GET http://localhost:8080/rooms/{roomId}
```

### Join Room
```bash
curl -X POST http://localhost:8080/rooms/{roomId}/join \
  -H "Authorization: Bearer <TOKEN>"
```

### Get Participants
```bash
curl -X GET http://localhost:8080/rooms/{roomId}/participants \
  -H "Authorization: Bearer <TOKEN>"
```

### Leave Room
```bash
curl -X POST http://localhost:8080/rooms/{roomId}/leave \
  -H "Authorization: Bearer <TOKEN>"
```

## Chat

### Get Messages
```bash
curl -X GET "http://localhost:8080/rooms/{roomId}/messages?limit=50&offset=0" \
  -H "Authorization: Bearer <TOKEN>"
```

### Send Message
```bash
curl -X POST http://localhost:8080/rooms/{roomId}/messages \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello everyone!"}'
```

## WebSocket (Signaling)

### Connect
```javascript
const token = "YOUR_JWT_TOKEN";
const roomId = "ROOM_ID";

const ws = new WebSocket(
  `ws://localhost:8080/signaling?room=${roomId}`,
  [token]
);

ws.onopen = () => {
  console.log('Connected to signaling server');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'join') {
    console.log(`User ${message.from} joined`);
  } else if (message.type === 'offer') {
    console.log('Received offer from', message.from);
    // Handle WebRTC offer
  }
};

// Send offer to specific peer
ws.send(JSON.stringify({
  type: 'offer',
  to: 'peer_id',
  data: { sdp: 'offer_sdp_string' }
}));

// Send ICE candidate
ws.send(JSON.stringify({
  type: 'ice-candidate',
  to: 'peer_id',
  data: { candidate: ice_candidate }
}));
```

## Testing with httpie

```bash
# Register
http POST localhost:8080/auth/register \
  email=user@example.com \
  password=password123

# Login and save token
TOKEN=$(http POST localhost:8080/auth/login \
  email=user@example.com \
  password=password123 | jq -r '.token')

# Create room
http POST localhost:8080/rooms \
  "Authorization: Bearer $TOKEN" \
  name="My Conference" \
  type=private

# List rooms
http GET localhost:8080/rooms
```
