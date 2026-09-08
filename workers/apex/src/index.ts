const homepage = String.raw`<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Miithii — High-Performance AI Product Suite</title>
    <meta name="description" content="Miithii is a focused suite of high-performance AI tools for conversation, frame-accurate subtitles, and real-time voice." />
    <link rel="canonical" href="https://miithii.in/" />
    <meta name="theme-color" content="#081F1C" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
    <style>
      :root {
        --teal-950: #081f1c;
        --teal-900: #0b3b36;
        --teal-800: #124842;
        --surface: #0e302b;
        --surface-hover: #143e38;
        --border: #1d4d44;
        --border-light: rgba(198, 255, 61, 0.15);
        --cream: #f2f5f1;
        --muted: #9fc2b7;
        --jade: #1d9e75;
        --jade-bright: #35c696;
        --lime: #c6ff3d;
        --lime-soft: rgba(198, 255, 61, 0.1);
        --coral: #ff7a59;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      html, body {
        min-height: 100%;
        background-color: var(--teal-950);
        color: var(--cream);
        font-family: "Manrope", system-ui, -apple-system, sans-serif;
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
        overflow-x: hidden;
      }

      /* Ambient background glow */
      body::before {
        content: "";
        position: fixed;
        top: -150px;
        left: 50%;
        transform: translateX(-50%);
        width: min(1000px, 100vw);
        height: 600px;
        background: radial-gradient(circle at center, rgba(29, 158, 117, 0.18) 0%, rgba(198, 255, 61, 0.05) 35%, transparent 70%);
        pointer-events: none;
        z-index: 0;
      }

      .container {
        max-width: 1160px;
        margin: 0 auto;
        padding: 0 24px;
        position: relative;
        z-index: 1;
      }

      /* Header */
      header {
        position: sticky;
        top: 0;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        background: rgba(8, 31, 28, 0.75);
        border-bottom: 1px solid rgba(29, 77, 68, 0.4);
        z-index: 100;
      }

      .nav-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 72px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
        color: var(--cream);
      }

      .brand-logo {
        width: 38px;
        height: 32px;
      }

      .brand-name {
        font-family: "Space Grotesk", sans-serif;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.5px;
      }

      .nav-links {
        display: flex;
        align-items: center;
        gap: 28px;
      }

      .nav-link {
        color: var(--muted);
        text-decoration: none;
        font-size: 15px;
        font-weight: 500;
        transition: color 0.2s ease;
      }

      .nav-link:hover {
        color: var(--lime);
      }

      .nav-cta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: var(--lime);
        color: #081f1c;
        padding: 10px 18px;
        border-radius: 999px;
        font-size: 14px;
        font-weight: 700;
        text-decoration: none;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }

      .nav-cta:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 18px rgba(198, 255, 61, 0.35);
      }

      /* Hero Section */
      .hero {
        padding: 96px 0 64px;
        text-align: center;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        background: var(--lime-soft);
        border: 1px solid var(--border-light);
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
        color: var(--lime);
        margin-bottom: 28px;
        letter-spacing: 0.2px;
      }

      .badge-dot {
        width: 7px;
        height: 7px;
        background: var(--lime);
        border-radius: 50%;
        box-shadow: 0 0 8px var(--lime);
        animation: pulse 2s infinite ease-in-out;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.85); }
      }

      .hero h1 {
        font-family: "Space Grotesk", sans-serif;
        font-size: clamp(38px, 6vw, 68px);
        font-weight: 700;
        line-height: 1.1;
        letter-spacing: -1.5px;
        margin-bottom: 24px;
        color: var(--cream);
      }

      .hero h1 span {
        background: linear-gradient(135deg, var(--cream) 40%, var(--lime) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .hero-sub {
        font-size: clamp(17px, 2.2vw, 20px);
        color: var(--muted);
        max-width: 680px;
        margin: 0 auto 40px;
        font-weight: 400;
      }

      .hero-actions {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
      }

      .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: var(--lime);
        color: #081f1c;
        font-size: 16px;
        font-weight: 700;
        padding: 14px 28px;
        border-radius: 12px;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(198, 255, 61, 0.4);
      }

      .btn-secondary {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: var(--surface);
        color: var(--cream);
        border: 1px solid var(--border);
        font-size: 16px;
        font-weight: 600;
        padding: 14px 26px;
        border-radius: 12px;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-secondary:hover {
        background: var(--surface-hover);
        border-color: var(--jade);
        transform: translateY(-2px);
      }

      /* Suite Apps Grid */
      .section-title {
        text-align: center;
        margin: 72px 0 40px;
      }

      .section-title h2 {
        font-family: "Space Grotesk", sans-serif;
        font-size: 32px;
        font-weight: 700;
        letter-spacing: -0.5px;
        margin-bottom: 8px;
      }

      .section-title p {
        color: var(--muted);
        font-size: 16px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 24px;
        margin-bottom: 80px;
      }

      .card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 32px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        text-decoration: none;
        color: inherit;
        transition: all 0.25s ease;
        position: relative;
        overflow: hidden;
      }

      .card::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: transparent;
        transition: background 0.25s ease;
      }

      .card:hover {
        transform: translateY(-4px);
        border-color: var(--jade);
        box-shadow: 0 16px 36px rgba(8, 31, 28, 0.6);
      }

      .card.featured {
        border-color: rgba(198, 255, 61, 0.4);
        background: linear-gradient(180deg, rgba(14, 48, 43, 0.95) 0%, rgba(11, 37, 33, 0.95) 100%);
      }

      .card.featured::before {
        background: var(--lime);
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
      }

      .card-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: rgba(29, 158, 117, 0.2);
        display: grid;
        place-items: center;
        color: var(--lime);
        font-size: 22px;
      }

      .card-pill {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(29, 158, 117, 0.25);
        color: var(--jade-bright);
        border: 1px solid rgba(29, 158, 117, 0.3);
      }

      .card-pill.hot {
        background: var(--lime-soft);
        color: var(--lime);
        border-color: var(--border-light);
      }

      .card-title {
        font-family: "Space Grotesk", sans-serif;
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 10px;
        color: var(--cream);
      }

      .card-desc {
        color: var(--muted);
        font-size: 15px;
        line-height: 1.6;
        margin-bottom: 28px;
      }

      .card-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        font-weight: 700;
        color: var(--lime);
      }

      .card:hover .card-link {
        gap: 10px;
      }

      /* Features banner */
      .banner {
        background: linear-gradient(135deg, rgba(14, 48, 43, 0.6) 0%, rgba(8, 31, 28, 0.8) 100%);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 44px 36px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 32px;
        margin-bottom: 96px;
      }

      .banner-item h3 {
        font-family: "Space Grotesk", sans-serif;
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 8px;
        color: var(--cream);
      }

      .banner-item p {
        font-size: 14px;
        color: var(--muted);
        line-height: 1.5;
      }

      /* Footer */
      footer {
        border-top: 1px solid rgba(29, 77, 68, 0.4);
        padding: 40px 0;
        color: var(--muted);
        font-size: 14px;
      }

      .footer-wrap {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 20px;
      }

      .footer-links {
        display: flex;
        gap: 24px;
      }

      .footer-links a {
        color: var(--muted);
        text-decoration: none;
        transition: color 0.2s ease;
      }

      .footer-links a:hover {
        color: var(--lime);
      }

      @media (max-width: 640px) {
        .nav-links {
          display: none;
        }
        .hero {
          padding: 64px 0 40px;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="container nav-bar">
        <a href="https://miithii.in/" class="brand" aria-label="Miithii home">
          <svg class="brand-logo" viewBox="0 0 58 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Miithii">
            <rect x="4" y="17" width="6" height="14" rx="3" fill="var(--jade)" />
            <rect x="15" y="12" width="6" height="24" rx="3" fill="var(--jade)" />
            <rect x="26" y="6" width="6" height="36" rx="3" fill="var(--lime)" />
            <rect x="37" y="12" width="6" height="24" rx="3" fill="var(--jade)" />
            <rect x="48" y="17" width="6" height="14" rx="3" fill="var(--jade)" />
          </svg>
          <span class="brand-name">miithii</span>
        </a>
        <nav class="nav-links">
          <a href="https://chat.miithii.in/" class="nav-link">Chat</a>
          <a href="https://subtitles.miithii.in/" class="nav-link">Subtitles</a>
          <a href="https://voice.miithii.in/" class="nav-link">Voice</a>
          <a href="https://chat.miithii.in/" class="nav-cta">Open Chat App →</a>
        </nav>
      </div>
    </header>

    <main>
      <div class="container hero">
        <div class="badge">
          <span class="badge-dot"></span>
          Unified AI Product Suite
        </div>
        <h1>Intelligence that moves<br /><span>at your speed.</span></h1>
        <p class="hero-sub">
          A focused ecosystem of high-performance AI tools for thought, localized translation, and voice synthesis.
        </p>
        <div class="hero-actions">
          <a href="https://chat.miithii.in/" class="btn-primary">
            Launch Miithii Chat
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          <a href="https://subtitles.miithii.in/" class="btn-secondary">
            Explore Subtitles
          </a>
        </div>

        <div class="section-title">
          <h2>The Miithii Suite</h2>
          <p>Autonomous apps engineered for specific creative workflows</p>
        </div>

        <div class="grid">
          <!-- Chat App -->
          <a href="https://chat.miithii.in/" class="card featured">
            <div>
              <div class="card-header">
                <div class="card-icon">💬</div>
                <span class="card-pill hot">Live on chat.miithii.in</span>
              </div>
              <h3 class="card-title">Miithii Chat</h3>
              <p class="card-desc">
                High-performance conversational intelligence with markdown streaming, persistent workspace memory, and deep reasoning across Indian languages and English.
              </p>
            </div>
            <div class="card-link">
              Open Chat Workspace →
            </div>
          </a>

          <!-- Subtitles App -->
          <a href="https://subtitles.miithii.in/" class="card">
            <div>
              <div class="card-header">
                <div class="card-icon">🎬</div>
                <span class="card-pill">subtitles.miithii.in</span>
              </div>
              <h3 class="card-title">Miithii Subtitles</h3>
              <p class="card-desc">
                Frame-accurate automatic speech recognition, automated caption styling, and multi-dialect translation built specifically for video creators and studios.
              </p>
            </div>
            <div class="card-link">
              Explore Subtitles →
            </div>
          </a>

          <!-- Voice App -->
          <a href="https://voice.miithii.in/" class="card">
            <div>
              <div class="card-header">
                <div class="card-icon">🎙️</div>
                <span class="card-pill">Preview</span>
              </div>
              <h3 class="card-title">Miithii Voice</h3>
              <p class="card-desc">
                Ultra-low latency expressive voice synthesis and conversational audio pipeline with real-time turn-taking and natural prosody.
              </p>
            </div>
            <div class="card-link">
              View Voice Suite →
            </div>
          </a>
        </div>

        <!-- Infrastructure Highlights -->
        <div class="banner">
          <div class="banner-item">
            <h3>⚡ 0ms Cold Starts</h3>
            <p>Deployed globally across Cloudflare's edge network for instantaneous responses worldwide.</p>
          </div>
          <div class="banner-item">
            <h3>🔒 Sovereign & Private</h3>
            <p>Your workspace data and generation memory stay strictly protected with end-to-end encryption.</p>
          </div>
          <div class="banner-item">
            <h3>🌐 Native Multilingual</h3>
            <p>Fine-tuned for Indian languages with authentic dialectal context, nuance, and cultural fluency.</p>
          </div>
        </div>
      </div>
    </main>

    <footer>
      <div class="container footer-wrap">
        <div>© 2026 Miithii. All rights reserved.</div>
        <div class="footer-links">
          <a href="https://chat.miithii.in/">Chat</a>
          <a href="https://subtitles.miithii.in/">Subtitles</a>
          <a href="https://voice.miithii.in/">Voice</a>
          <a href="https://miithii.in/sitemap.xml">Sitemap</a>
        </div>
      </div>
    </footer>
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
    <lastmod>2026-09-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://chat.miithii.in/</loc>
    <lastmod>2026-09-06</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://subtitles.miithii.in/</loc>
    <lastmod>2026-09-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
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
