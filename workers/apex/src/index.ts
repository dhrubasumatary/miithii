type Env = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

const robots = String.raw`User-agent: *
Allow: /

Sitemap: https://miithii.in/sitemap.xml
`;

const sitemap = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://miithii.in/</loc><lastmod>2026-09-12</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://chat.miithii.in/</loc><lastmod>2026-09-12</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>https://voice.miithii.in/</loc><lastmod>2026-09-12</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://subtitles.miithii.in/</loc><lastmod>2026-09-12</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
</urlset>
`;

function textResponse(body: string, contentType: string, noindex: boolean) {
  const headers = new Headers({
    "content-type": contentType,
    "cache-control": "public, max-age=300, s-maxage=3600",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff"
  });
  if (noindex) headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(body, { headers });
}

function secureAsset(response: Response, noindex: boolean) {
  const headers = new Headers(response.headers);
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-content-type-options", "nosniff");
  headers.set(
    "content-security-policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'"
  );
  if (noindex) headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.hostname === "www.miithii.in") {
      url.hostname = "miithii.in";
      return Response.redirect(url.toString(), 301);
    }

    const noindex = url.hostname.endsWith("workers.dev");
    if (url.pathname === "/robots.txt") return textResponse(robots, "text/plain; charset=utf-8", noindex);
    if (url.pathname === "/sitemap.xml") return textResponse(sitemap, "application/xml; charset=utf-8", noindex);

    return secureAsset(await env.ASSETS.fetch(request), noindex);
  }
};
