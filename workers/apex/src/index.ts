const homepage = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Miithii — Chat, Voice & Subtitles</title>
    <meta name="description" content="Miithii is a focused set of Chat, Voice and Subtitles tools for Assamese and Bodo." />
    <link rel="canonical" href="https://miithii.in/" />
    <meta name="theme-color" content="#fbfaf7" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Miithii — Chat, Voice & Subtitles" />
    <meta property="og:description" content="Chat, Voice and Subtitles for everyday Assamese and Bodo use." />
    <meta property="og:url" content="https://miithii.in/" />
    <meta name="twitter:card" content="summary" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
    <style>
      :root {
        --bg: #fbfaf7;
        --surface: #fffefd;
        --text: #241b26;
        --muted: #776d7b;
        --secondary: #4e4552;
        --border: rgba(36, 27, 38, 0.1);
        --primary: #1d9e75;
        --primary-hover: #167a5b;
        --shadow: 0 1px 3px rgba(36, 27, 38, 0.045), 0 8px 28px rgba(71, 54, 76, 0.045);
      }

      * { box-sizing: border-box; }
      html { background: var(--bg); }
      body {
        min-height: 100vh;
        margin: 0;
        background:
          radial-gradient(980px 680px at -8% -18%, rgba(216, 187, 238, 0.4), transparent 64%),
          radial-gradient(940px 660px at 108% -12%, rgba(165, 226, 207, 0.34), transparent 64%),
          var(--bg);
        color: var(--text);
        font-family: "Manrope", system-ui, sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      a { color: inherit; text-decoration: none; }
      a:focus-visible { outline: 3px solid rgba(29, 158, 117, 0.24); outline-offset: 3px; }

      .dock {
        position: fixed;
        top: 14px;
        left: 50%;
        z-index: 20;
        display: grid;
        width: min(calc(100% - 28px), 1180px);
        min-height: 54px;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 18px;
        padding: 8px 14px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: rgba(255, 253, 251, 0.76);
        backdrop-filter: blur(22px) saturate(145%);
        box-shadow: var(--shadow);
        transform: translateX(-50%);
      }

      .brand {
        display: inline-flex;
        width: fit-content;
        align-items: center;
        gap: 9px;
        font-family: "Space Grotesk", system-ui, sans-serif;
        font-size: 19px;
        font-weight: 600;
        letter-spacing: -0.025em;
      }

      .brand svg { width: 28px; height: 24px; }

      .nav { display: flex; align-items: center; justify-content: center; gap: 4px; }
      .nav a {
        min-height: 34px;
        display: inline-flex;
        align-items: center;
        padding: 0 12px;
        border: 1px solid transparent;
        border-radius: 999px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 650;
      }
      .nav a:hover { border-color: var(--border); background: rgba(36, 27, 38, 0.045); color: var(--text); }
      .dock-end { min-width: 1px; }

      main {
        min-height: 100dvh;
        padding: 106px 22px 30px;
      }

      .launcher { width: min(940px, 100%); margin: 0 auto; }
      .intro { max-width: 720px; margin-bottom: clamp(34px, 6vw, 62px); }

      .pronunciation {
        margin: 0 0 16px;
        color: var(--primary);
        font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.035em;
      }
      .pronunciation span { color: var(--muted); font-weight: 600; }

      h1 {
        max-width: 12ch;
        margin: 0;
        font-family: "Space Grotesk", system-ui, sans-serif;
        font-size: clamp(46px, 7.2vw, 86px);
        font-weight: 620;
        letter-spacing: -0.055em;
        line-height: 0.96;
        text-wrap: balance;
      }

      .summary {
        max-width: 560px;
        margin: 20px 0 0;
        color: var(--muted);
        font-size: clamp(15px, 1.8vw, 18px);
        line-height: 1.55;
      }

      .products { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .product {
        display: flex;
        min-height: 190px;
        flex-direction: column;
        padding: 20px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: rgba(255, 254, 253, 0.78);
        box-shadow: var(--shadow);
        transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
      }
      .product:hover, .product:focus-visible {
        border-color: rgba(29, 158, 117, 0.36);
        background: var(--surface);
        transform: translateY(-2px);
        outline: none;
      }
      .product-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
      .product h2 {
        margin: 0;
        font-family: "Space Grotesk", system-ui, sans-serif;
        font-size: 28px;
        font-weight: 620;
        letter-spacing: -0.035em;
      }
      .product-arrow { color: var(--primary); font-size: 18px; transition: transform 160ms ease; }
      .product:hover .product-arrow { transform: translate(2px, -2px); }
      .product p { margin: 18px 0 24px; color: var(--muted); font-size: 13.5px; line-height: 1.55; }
      .product small {
        margin-top: auto;
        color: var(--secondary);
        font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      @media (min-width: 900px) and (min-height: 700px) {
        main { display: grid; align-items: center; padding-top: 88px; }
      }

      @media (max-width: 760px) {
        .dock {
          top: 8px;
          width: calc(100% - 16px);
          grid-template-columns: 1fr auto;
          padding: 7px 8px 7px 10px;
          border-radius: 15px;
        }
        .brand { font-size: 17px; }
        .brand svg { width: 25px; height: 21px; }
        .nav { gap: 1px; }
        .nav a { padding: 0 8px; font-size: 11.5px; }
        .dock-end { display: none; }
        main { padding: 90px 14px 18px; }
        .intro { margin-bottom: 28px; }
        .pronunciation { margin-bottom: 12px; font-size: 10.5px; }
        h1 { max-width: 9.5ch; font-size: clamp(43px, 13vw, 62px); }
        .summary { margin-top: 15px; font-size: 14px; }
        .products { grid-template-columns: 1fr; gap: 9px; }
        .product { min-height: 0; padding: 16px; border-radius: 15px; }
        .product h2 { font-size: 23px; }
        .product p { margin: 9px 0 14px; font-size: 12.5px; }
      }

      @media (prefers-reduced-motion: reduce) {
        .product, .product-arrow { transition: none; }
      }
    </style>
  </head>
  <body>
    <header class="dock">
      <a class="brand" href="https://miithii.in/" aria-label="Miithii home">
        <svg viewBox="0 0 58 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="4" y="17" width="6" height="14" rx="3" fill="#1d9e75" />
          <rect x="15" y="12" width="6" height="24" rx="3" fill="#1d9e75" />
          <rect x="26" y="6" width="6" height="36" rx="3" fill="#c6ff3d" />
          <rect x="37" y="12" width="6" height="24" rx="3" fill="#1d9e75" />
          <rect x="48" y="17" width="6" height="14" rx="3" fill="#1d9e75" />
        </svg>
        <span>miithii</span>
      </a>
      <nav class="nav" aria-label="Miithii products">
        <a href="https://chat.miithii.in/">Chat</a>
        <a href="https://voice.miithii.in/">Voice</a>
        <a href="https://subtitles.miithii.in/">Subtitles</a>
      </nav>
      <span class="dock-end" aria-hidden="true"></span>
    </header>

    <main>
      <section class="launcher" aria-labelledby="title">
        <div class="intro">
          <p class="pronunciation">Miithii <span>/ˈmiː.θiː/</span> · MEE-thee</p>
          <h1 id="title">Choose how you want to talk.</h1>
          <p class="summary">Chat, voice, and subtitles for everyday Assamese and Bodo use.</p>
        </div>

        <div class="products" aria-label="Miithii products">
          <a class="product" href="https://chat.miithii.in/">
            <div class="product-top"><h2>Chat</h2><span class="product-arrow" aria-hidden="true">↗</span></div>
            <p>Write, ask, think, or just talk. Sign in once and keep your conversations with you.</p>
            <small>50 messages / day</small>
          </a>
          <a class="product" href="https://voice.miithii.in/">
            <div class="product-top"><h2>Voice</h2><span class="product-arrow" aria-hidden="true">↗</span></div>
            <p>Speak naturally. Choose Assamese or Bodo for Miithii’s reply, then pause when you’re done.</p>
            <small>Assamese · Bodo</small>
          </a>
          <a class="product" href="https://subtitles.miithii.in/">
            <div class="product-top"><h2>Subtitles</h2><span class="product-arrow" aria-hidden="true">↗</span></div>
            <p>Assamese captions for video and audio. Join the launch list while we finish the pipeline.</p>
            <small>Waitlist · no account</small>
          </a>
        </div>
      </section>
    </main>
  </body>
</html>`;

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

function response(body: string, contentType: string, noindex: boolean) {
  const headers = new Headers({
    "content-type": contentType,
    "cache-control": "public, max-age=300, s-maxage=3600",
    "content-security-policy": "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; base-uri 'none'; frame-ancestors 'none'",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff"
  });
  if (noindex) headers.set("x-robots-tag", "noindex, nofollow");
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
    if (url.pathname === "/robots.txt") return response(robots, "text/plain; charset=utf-8", noindex);
    if (url.pathname === "/sitemap.xml") return response(sitemap, "application/xml; charset=utf-8", noindex);
    return response(homepage, "text/html; charset=utf-8", noindex);
  }
};
