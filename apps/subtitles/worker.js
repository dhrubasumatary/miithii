const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 4096;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

async function joinWaitlist(request, env) {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return json({ message: "Enter a valid email address." }, 413);
  }

  let email = "";
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return json({ message: "Enter a valid email address." }, 400);
  }

  if (!EMAIL.test(email) || email.length > 254) {
    return json({ message: "Enter a valid email address." }, 400);
  }

  if (!env.WAITLIST_KEY) {
    return json({ message: "Waitlist is being connected. Please try again shortly." }, 503);
  }

  try {
    const response = await fetch(`https://waitlister.me/s/${encodeURIComponent(env.WAITLIST_KEY)}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      console.error(JSON.stringify({ event: "waitlist_submission_failed", status: response.status }));
      return json({ message: "Could not join right now. Please try again." }, 502);
    }
    return json({ message: "Joined" });
  } catch (error) {
    console.error(JSON.stringify({
      event: "waitlist_submission_failed",
      type: error?.name || "Error"
    }));
    return json({ message: "Could not join right now. Please try again." }, 502);
  }
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api/waitlist" && request.method === "POST") {
      return joinWaitlist(request, env);
    }
    if (pathname.startsWith("/api/")) {
      return json({ message: "Not found" }, 404);
    }
    return env.ASSETS.fetch(request);
  }
};
