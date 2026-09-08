export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;

    // The API Worker owns all validation, quota, prompt, model, and anonymous
    // identity behavior. This Worker only gives the browser a same-origin path.
    if (pathname === "/api/chat" || pathname === "/session") {
      return env.MIITHII_API.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
};
