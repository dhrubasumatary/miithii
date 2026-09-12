export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;

    // The API Worker owns all validation, quota, prompt, model, and identity
    // behavior. This Worker only gives the browser a same-origin path.
    if (
      pathname === "/api/uploads" ||
      pathname.startsWith("/api/uploads/") ||
      pathname === "/api/chat" ||
      pathname === "/api/chat/v2" ||
      pathname === "/api/usage" ||
      pathname === "/api/memory" ||
      pathname === "/api/memory/prefs"
    ) {
      return env.MIITHII_API.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
};
