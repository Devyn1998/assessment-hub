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

// ---------- TURN credentials ----------
// The previous setup shipped a permanent TURN username/password inside
// rtc-config.js, which every visitor's browser could read straight off the
// page. That is almost certainly how a 500MB monthly quota vanished. The
// long-lived secret now stays here on the server, and each client asks for a
// short-lived credential that expires on its own.
const TURN_KEY_ID = process.env.CF_TURN_KEY_ID || '';
const TURN_API_TOKEN = process.env.CF_TURN_API_TOKEN || '';
const TURN_TTL_SECONDS = 2 * 60 * 60; // a session credential, not a standing one

app.get('/api/ice', async (req, res) => {
  if (!TURN_KEY_ID || !TURN_API_TOKEN) {
    // No relay configured: STUN alone still connects same-network calls, so
    // degrade instead of failing the whole session.
    return res.json({
      iceServers: [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }],
      relay: false,
    });
  }
  try {
    const r = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
      }
    );
    if (!r.ok) throw new Error('Cloudflare TURN responded ' + r.status);
    const data = await r.json();
    res.set('Cache-Control', 'no-store');
    res.json({ iceServers: data.iceServers, relay: true });
  } catch (e) {
    console.warn('TURN credential mint failed, falling back to STUN:', e.message);
    res.json({
      iceServers: [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }],
      relay: false,
    });
  }
});

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
