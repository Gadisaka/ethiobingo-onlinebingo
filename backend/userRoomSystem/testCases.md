# User-Hosted Room Test Cases

## Create Room

### 1. Success

- Send POST /api/user-rooms/create with valid JSON body:
  `{ "stake": 100, "max_players": 5, "hostUserId": "<validUserId>" }`
- Expected: 201 Created, response contains room object with 6-digit roomId.

### 2. Missing Fields

- Send POST /api/user-rooms/create with missing stake or max_players or hostUserId.
- Expected: 400 Bad Request with clear error message.

### 3. RoomId Collision (rare)

- If the roomId generator produces duplicate after 5 retries (simulate if possible).
- Expected: 500 error about generating unique roomId.

## Join Room

### 1. Success

- Send POST /api/user-rooms/join with valid { roomId, userId } for not-full room, userId not present yet.
- Expected: 200 OK with room object, status message "Joined room."

### 2. Already Joined

- Send POST /api/user-rooms/join with { roomId, userId } where userId is already in room.
- Expected: 200 OK, status message "Already joined."

### 3. Room Not Found

- Send POST /api/user-rooms/join with invalid/nonexistent roomId.
- Expected: 404 Not Found, error message.

### 4. Room Full

- Add players so current players.length === max_players, send another join.
- Expected: 403 Forbidden, error message "Room is full."
