// Shared ICE server config for both operator and homeowner pages.
// STUN alone isn't enough when one side is on cellular data and the other
// is on a home network with mismatched IPv4/IPv6 (a very common case for
// this app: phone on the wall vs. laptop on wifi). The TURN relay below
// is what lets those two sides find each other when a direct path isn't
// possible. Free tier: 500MB/month via Metered.ca.
window.HUD_ICE_SERVERS = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
        urls: 'turn:global.relay.metered.ca:80',
        username: '2462a89f1ade1d39c008c01c',
        credential: 's/E/vZA0913odNc5'
  },
  {
        urls: 'turn:global.relay.metered.ca:80?transport=tcp',
        username: '2462a89f1ade1d39c008c01c',
        credential: 's/E/vZA0913odNc5'
  },
  {
        urls: 'turn:global.relay.metered.ca:443',
        username: '2462a89f1ade1d39c008c01c',
        credential: 's/E/vZA0913odNc5'
  },
  {
        urls: 'turns:global.relay.metered.ca:443?transport=tcp',
        username: '2462a89f1ade1d39c008c01c',
        credential: 's/E/vZA0913odNc5'
  }
  ];
