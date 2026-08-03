// Shared ICE server config for both operator and homeowner pages.
// STUN (Google, free/public) handles most home-network NATs. The Open
// Relay Project TURN servers (free, no signup) are included as a fallback
// for stricter networks (e.g. some mobile carriers / guest wifi).
window.HUD_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];
