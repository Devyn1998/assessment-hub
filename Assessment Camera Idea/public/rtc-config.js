// Shared ICE server config for both operator and homeowner pages.
//
// This file used to hard-code a permanent TURN username and password. That is
// readable by anyone who opens the app — the browser has to be handed the
// credential to use it — so the secret was effectively public, and the monthly
// relay quota drained until the provider disabled the server mid-testing.
//
// Now the long-lived key lives only on the server (CF_TURN_KEY_ID /
// CF_TURN_API_TOKEN), and each page asks /api/ice for a short-lived credential
// that expires on its own. Nothing sensitive ships to the browser.
//
// STUN alone is enough when both devices share a network; the TURN relay is
// what makes a phone on cellular reach a laptop on home wifi.
window.HUD_ICE_SERVERS = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
];

// Resolves once the real (relay-capable) servers have been fetched. Both pages
// await this before creating their RTCPeerConnection.
window.HUD_ICE_READY = (async () => {
  try {
    const res = await fetch('/api/ice', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (Array.isArray(data.iceServers) && data.iceServers.length) {
      window.HUD_ICE_SERVERS = data.iceServers;
      window.HUD_ICE_RELAY = !!data.relay;
    }
  } catch (e) {
    // Keep the STUN-only default rather than blocking the call entirely.
    console.warn('Could not fetch ICE servers, using STUN only:', e.message);
    window.HUD_ICE_RELAY = false;
  }
  return window.HUD_ICE_SERVERS;
})();
