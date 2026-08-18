const homepage = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Miithii</title>
    <meta name="description" content="Miithii." />
    <link rel="canonical" href="https://miithii.in/" />
    <meta name="theme-color" content="#081F1C" />
    <style>
      :root {
        --bg: #f2f5f1;
        --ink: #0b3b36;
        --jade: #1d9e75;
        --lime: #c6ff3d;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        min-height: 100%;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
      }

      main {
        display: grid;
        min-height: 100dvh;
        place-items: center;
        padding: 24px;
      }

      .wordmark {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--ink);
        font-size: 29px;
        font-weight: 650;
        line-height: 1;
      }

      svg {
        width: 43px;
        height: 36px;
        flex: 0 0 auto;
      }

      .text {
        transform: translateY(-1px);
      }
    </style>
  </head>
  <body>
    <main aria-label="Miithii home">
      <span class="wordmark" aria-label="Miithii">
        <svg viewBox="0 0 58 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Miithii">
          <rect x="4" y="17" width="6" height="14" rx="3" fill="var(--jade)" />
          <rect x="15" y="12" width="6" height="24" rx="3" fill="var(--jade)" />
          <rect x="26" y="6" width="6" height="36" rx="3" fill="var(--lime)" />
          <rect x="37" y="12" width="6" height="24" rx="3" fill="var(--jade)" />
          <rect x="48" y="17" width="6" height="14" rx="3" fill="var(--jade)" />
        </svg>
        <span class="text">miithii</span>
      </span>
    </main>
  </body>
</html>`;

const robots = String.raw`User-agent: *
Allow: /

Sitemap: https://miithii.in/sitemap.xml
`;

const sitemap = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://miithii.in/</loc>
    <lastmod>2026-08-18</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

function response(body: string, contentType: string, noindex: boolean) {
  const headers = new Headers({
    "content-type": contentType,
    "cache-control": "public, max-age=300, s-maxage=3600",
    "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff"
  });

  if (noindex) {
    headers.set("x-robots-tag", "noindex, nofollow");
  }

  return new Response(body, { headers });
}

export default {
  fetch(request: Request) {
    const url = new URL(request.url);

    if (url.hostname === "www.miithii.in") {
      url.hostname = "miithii.in";
      return Response.redirect(url.toString(), 301);
    }

    const noindex = url.hostname.endsWith("workers.dev");

    if (url.pathname === "/robots.txt") {
      return response(robots, "text/plain; charset=utf-8", noindex);
    }

    if (url.pathname === "/sitemap.xml") {
      return response(sitemap, "application/xml; charset=utf-8", noindex);
    }

    return response(homepage, "text/html; charset=utf-8", noindex);
  }
};
