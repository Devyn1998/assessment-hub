// HUD Assessment App — signaling server
// Relays WebRTC offer/answer/ICE between an "operator" (laptop) and a
// "homeowner" (phone/tablet) inside a shared room, and relays measurement
// events so the operator's screen can show live measurement results.

const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory room registry. A room holds up to one operator + one
// homeowner connection. Rooms are created on demand and cleaned up when
// both sides disconnect.
const rooms = new Map(); // roomId -> { operator: ws|null, homeowner: ws|null }

function makeRoomId() {
  return crypto.randomBytes(3).toString('hex'); // short, link-friendly
}

app.get('/api/new-room', (req, res) => {
  let id;
  do {
    id = makeRoomId();
  } while (rooms.has(id));
  rooms.set(id, { operator: null, homeowner: null });
  res.json({ roomId: id });
});

app.get('/', (req, res) => {
  res.redirect('/operator');
});

app.get('/operator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'operator.html'));
});

app.get('/join/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'homeowner.html'));
});

app.get('/health', (req, res) => res.json({ ok: true }));

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

wss.on('connection', (ws) => {
  ws.role = null;
  ws.roomId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (msg.type === 'join') {
      const { roomId, role } = msg; // role: 'operator' | 'homeowner'
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { operator: null, homeowner: null });
      }
      const room = rooms.get(roomId);
      if (role !== 'operator' && role !== 'homeowner') return;

      room[role] = ws;
      ws.role = role;
      ws.roomId = roomId;

      send(ws, { type: 'joined', role, roomId });

      const other = role === 'operator' ? room.homeowner : room.operator;
      if (other) {
        send(other, { type: 'peer-joined', role });
        send(ws, { type: 'peer-joined', role: role === 'operator' ? 'homeowner' : 'operator' });
      }
      return;
    }

    // Everything else gets relayed to the other party in the same room.
    const room = rooms.get(ws.roomId);
    if (!room) return;
    const other = ws.role === 'operator' ? room.homeowner : room.operator;
    if (other) send(other, msg);
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomId);
    if (!room) return;
    if (room[ws.role] === ws) room[ws.role] = null;
    const other = ws.role === 'operator' ? room.homeowner : room.operator;
    if (other) send(other, { type: 'peer-left', role: ws.role });
    if (!room.operator && !room.homeowner) rooms.delete(ws.roomId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HUD assessment server listening on port ${PORT}`);
});
