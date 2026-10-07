export default {
  async fetch(request, env) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    if (url.pathname === '/Miithii.apk') {
      return new Response(null, { status: 302, headers: {
        Location: 'https://github.com/dhrubasumatary/miithii/releases/download/voice-2026-10-05-theme-preload/Miithii.apk',
        'Cache-Control': 'no-store',
      } });
    }
    return env.ASSETS.fetch(request);
  },
};
