# Assessment HUD

A two-way live video link between a homeowner's phone/tablet and your laptop,
plus a wall-to-wall measuring tool the homeowner runs on their end.

## What it does

- You (operator) open `/operator` on your laptop. It generates a one-time
  link and room code.
- You send that link to the homeowner (text, email, however you normally
  reach them). They open it in their phone/tablet browser — no app install.
- Once both sides are open, you see their live camera feed on your laptop,
  and they see/hear you in a small video box on their screen. Both mics are
  live, so you can talk them through it.
- The homeowner points their camera at a wall and measures the distance to
  the opposite wall in one of two ways:
  - **AR Measure** (Android + Chrome, ARCore-capable phones): a real
    point-and-walk AR measurement using the phone's depth-sensing hit-test.
    Tap once at wall A, walk/pan to wall B, tap again — the true 3D distance
    is calculated and sent to your screen instantly.
  - **Measure on Photo** (works on any phone, including iPhone): freezes a
    photo of the room, the homeowner taps the two ends of something with a
    known size already in frame (a door, a yardstick, a sheet of paper) and
    enters that size, then taps the two wall points — the app scales pixel
    distance to real-world distance. This is an estimate, not a laser-grade
    measurement, and works best when the whole room is visible in one shot.
- Every measurement (and a thumbnail, for the photo method) appears in a
  running log on your laptop screen automatically.

## Why iPhone can't do true AR measuring here

Safari on iOS does not support the WebXR APIs that give web pages access to
ARKit's depth/hit-testing data — that access is currently only exposed to
native apps, not the browser. That's why the app auto-detects AR support and
falls back to "Measure on Photo" on iPhones. If you need laser-accurate
measurements on iPhone specifically, that requires a native app (e.g. Apple's
own Measure app, or a LiDAR-based app on Pro models) run directly on the
homeowner's phone — not something a browser link can do.

## Important: this must be served over HTTPS

Browsers block camera/mic access and all AR features on any page that isn't
either `https://` or `localhost`. Don't try to run this over plain HTTP on
your local network and open it on the homeowner's phone — it will fail
silently (camera permission won't even prompt). Deploy it to a host that
gives you HTTPS for free (see below) rather than hosting it bare off your
laptop's IP.

## Free hosting route (recommended): Render

Render's free "Web Service" tier gives you a permanent `https://` URL, runs
Node + WebSockets (needed for the live signaling), and costs nothing.
Trade-off: a free service "spins down" after 15 minutes idle and takes
~30-50 seconds to wake up on the next visit — fine for an on-demand tool you
spin up right before an assessment call.

Steps:
1. Push this folder to a new GitHub repo (Render deploys from GitHub).
   - If you don't already have a GitHub account, create one free at
     github.com, then create a new repo and upload this folder's contents
     (or `git init && git add . && git commit -m "init" && git push`).
2. Go to render.com, sign up free, click **New > Web Service**, connect the
   GitHub repo you just made.
3. Settings: Build Command `npm install`, Start Command `npm start`,
   Instance Type: Free.
4. Deploy. Render gives you a URL like `https://your-app.onrender.com`.
5. Open `https://your-app.onrender.com/operator` on your laptop for every
   assessment — it generates a fresh homeowner link each time.

I can also do this deploy for you directly from this chat if you connect the
Render integration (I searched and found it's available but not yet
connected on your account) — just say the word and I'll walk you through
connecting it, then deploy this project myself.

### Alternatives
- **Railway** or **Fly.io** — same idea, both have free/trial tiers and
  support Node + WebSockets with automatic HTTPS.
- **ngrok** (if you want to keep it running off your own laptop instead of
  the cloud) — run `node server.js` locally, then `ngrok http 3000` to get a
  temporary public `https://` URL. Free tier works, but the URL changes
  every time you restart ngrok unless you pay for a reserved domain, and
  your laptop has to stay on and connected the whole time.

## Running it locally first (optional sanity check)

```
npm install
npm start
```

Then on your laptop open `http://localhost:3000/operator`. Camera/AR
features on the *homeowner* side won't work over plain `http://` from a
phone (see HTTPS note above) — local testing is really just for checking the
operator dashboard and server logic before you deploy.

## Known limitations (prototype, not a certified measuring tool)

- AR mode requires an ARCore-capable Android phone in Chrome; not all
  Android devices/browsers qualify.
- Photo-mode measurements are only as accurate as the reference object's
  known size and how flat/parallel the wall is to the camera — treat it as
  an estimate for planning, not a spec-grade measurement.
- No TURN server is bundled beyond the free Open Relay Project servers used
  as a fallback; on unusual corporate/hotel networks the video call may fail
  to connect peer-to-peer. If that happens repeatedly, a paid TURN service
  (e.g. Twilio, Metered.ca) can be swapped in via `public/rtc-config.js`.
- One homeowner + one operator per room. Multiple simultaneous assessments
  just need the operator to click "New Session" for each one (each gets its
  own link/room).

## File overview

- `server.js` — Express static server + WebSocket signaling relay + room
  management.
- `public/operator.html` — laptop dashboard (link generator, video, and
  measurement log).
- `public/homeowner.html` — phone/tablet page (camera, AR/photo measuring,
  two-way video).
- `public/rtc-config.js` — shared WebRTC ICE server list (STUN + free TURN
  fallback).
