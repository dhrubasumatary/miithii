const homepage = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Miithii — Chat, subtitles and voice for Indian languages</title>
    <meta name="description" content="Miithii builds focused language tools for conversation, subtitles and voice, starting with Assamese." />
    <link rel="canonical" href="https://miithii.in/" />
    <meta name="theme-color" content="#f4f4ed" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Miithii — Chat, subtitles and voice" />
    <meta property="og:description" content="Focused language tools for conversation, subtitles and voice, starting with Assamese." />
    <meta property="og:url" content="https://miithii.in/" />
    <meta name="twitter:card" content="summary" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
    <style>
      :root {
        --paper: #f4f4ed;
        --paper-deep: #e9ece5;
        --ink: #092b26;
        --ink-soft: #24443d;
        --muted: #637b74;
        --line: #cdd8d2;
        --line-strong: #aebfb7;
        --jade: #1d9e75;
        --jade-dark: #14765a;
        --lime: #c6ff3d;
        --night: #071f1c;
        --night-soft: #123a33;
        --white: #f8faf6;
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
        background: var(--paper);
      }

      body {
        min-height: 100%;
        margin: 0;
        background: var(--paper);
        color: var(--ink);
        font-family: "Manrope", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.55;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }

      a {
        color: inherit;
      }

      a:focus-visible {
        outline: 3px solid rgba(29, 158, 117, 0.34);
        outline-offset: 4px;
        border-radius: 4px;
      }

      .skip-link {
        position: fixed;
        left: 16px;
        top: 12px;
        z-index: 1000;
        transform: translateY(-160%);
        background: var(--night);
        color: var(--white);
        padding: 9px 12px;
        text-decoration: none;
      }

      .skip-link:focus {
        transform: translateY(0);
      }

      .shell {
        width: min(1240px, calc(100% - 48px));
        margin: 0 auto;
      }

      header {
        position: sticky;
        top: 0;
        z-index: 50;
        background: rgba(244, 244, 237, 0.96);
        border-bottom: 1px solid var(--line);
      }

      .nav {
        min-height: 76px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 28px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--ink);
        text-decoration: none;
        flex: 0 0 auto;
      }

      .brand svg {
        width: 36px;
        height: 30px;
      }

      .brand strong {
        font-family: "Space Grotesk", system-ui, sans-serif;
        font-size: 23px;
        line-height: 1;
        letter-spacing: -0.04em;
      }

      .nav-group {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }

      .nav-link,
      .nav-chat {
        min-height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 13px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 650;
        text-decoration: none;
      }

      .nav-link {
        color: var(--ink-soft);
      }

      .nav-link:hover {
        background: var(--paper-deep);
      }

      .nav-chat {
        margin-left: 6px;
        background: var(--ink);
        color: var(--white);
      }

      .nav-chat:hover {
        background: var(--jade-dark);
      }

      main {
        overflow: hidden;
      }

      .hero {
        padding: clamp(72px, 9vw, 132px) 0 72px;
        display: grid;
        grid-template-columns: minmax(0, 1.8fr) minmax(260px, 0.7fr);
        align-items: end;
        gap: clamp(48px, 8vw, 112px);
      }

      .kicker,
      .section-kicker,
      .product-number,
      .status,
      .fact-label {
        font-family: "Space Grotesk", system-ui, sans-serif;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .kicker {
        margin: 0 0 22px;
        color: var(--jade-dark);
      }

      .hero h1 {
        max-width: 900px;
        margin: 0;
        font-family: "Space Grotesk", system-ui, sans-serif;
        font-size: clamp(48px, 7.8vw, 96px);
        font-weight: 600;
        line-height: 0.95;
        letter-spacing: -0.065em;
        text-wrap: balance;
      }

      .hero h1 em {
        color: var(--jade-dark);
        font-style: normal;
      }

      .hero-intro {
        padding-top: 10px;
        border-top: 1px solid var(--line-strong);
      }

      .hero-intro p {
        margin: 0;
        color: var(--ink-soft);
        font-size: clamp(17px, 2vw, 21px);
        line-height: 1.55;
      }

      .hero-intro a {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-top: 30px;
        color: var(--ink);
        font-weight: 700;
        text-decoration: none;
      }

      .hero-intro a span {
        transition: transform 160ms ease;
      }

      .hero-intro a:hover span {
        transform: translateX(4px);
      }

      .manifesto {
        border-top: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
      }

      .manifesto-grid {
        min-height: 112px;
        display: grid;
        grid-template-columns: 0.7fr 1.3fr;
        align-items: center;
        gap: 32px;
      }

      .manifesto strong {
        font-family: "Space Grotesk", system-ui, sans-serif;
        font-size: 18px;
        letter-spacing: -0.025em;
      }

      .manifesto p {
        margin: 0;
        max-width: 720px;
        color: var(--muted);
        font-size: 15px;
      }

      .products {
        padding: 112px 0 124px;
      }

      .section-head {
        display: grid;
        grid-template-columns: 0.7fr 1.3fr;
        gap: 32px;
        align-items: start;
        margin-bottom: 38px;
      }

      .section-kicker {
        margin: 8px 0 0;
        color: var(--muted);
      }

      .section-head h2 {
        margin: 0;
        max-width: 760px;
        font-family: "Space Grotesk", system-ui, sans-serif;
        font-size: clamp(36px, 5vw, 60px);
        font-weight: 600;
        line-height: 1.02;
        letter-spacing: -0.055em;
      }

      .product-list {
        border-top: 1px solid var(--ink);
      }

      .product {
        display: grid;
        grid-template-columns: 88px minmax(210px, 0.72fr) minmax(0, 1.28fr);
        gap: 32px;
        padding: 42px 0 46px;
        border-bottom: 1px solid var(--line-strong);
      }

      .product-number {
        color: var(--muted);
        padding-top: 7px;
      }

      .product-name {
        margin: 0;
        font-family: "Space Grotesk", system-ui, sans-serif;
        font-size: clamp(28px, 3vw, 40px);
        font-weight: 600;
        line-height: 1.05;
        letter-spacing: -0.045em;
      }

      .status {
        display: block;
        width: fit-content;
        margin-top: 13px;
        color: var(--jade-dark);
      }

      .product-copy {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 28px;
        align-items: end;
      }

      .product-copy p {
        max-width: 650px;
        margin: 0;
        color: var(--ink-soft);
        font-size: 17px;
        line-height: 1.65;
      }

      .product-copy a {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        min-height: 42px;
        white-space: nowrap;
        color: var(--ink);
        font-size: 14px;
        font-weight: 750;
        text-decoration: none;
        border-bottom: 1px solid var(--ink);
      }

      .product-copy a:hover {
        color: var(--jade-dark);
        border-color: var(--jade-dark);
      }

      .story {
        background: var(--night);
        color: var(--white);
      }

      .story-inner {
        padding: clamp(76px, 9vw, 120px) 0;
        display: grid;
        grid-template-columns: 0.8fr 1.2fr;
        gap: clamp(48px, 8vw, 120px);
      }

      .story .section-kicker {
        color: #9fc2b7;
      }

      .story h2 {
        margin: 0;
        max-width: 480px;
        font-family: "Space Grotesk", system-ui, sans-serif;
        font-size: clamp(38px, 5vw, 64px);
        font-weight: 600;
        line-height: 1;
        letter-spacing: -0.055em;
      }

      .story-copy {
        display: grid;
        gap: 32px;
      }

      .story-copy > p {
        max-width: 690px;
        margin: 0;
        color: #c6d8d2;
        font-size: clamp(18px, 2.2vw, 22px);
        line-height: 1.62;
      }

      .facts {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        border-top: 1px solid #34534c;
      }

      .fact {
        min-height: 126px;
        padding: 24px 22px 0 0;
      }

      .fact + .fact {
        padding-left: 22px;
        border-left: 1px solid #34534c;
      }

      .fact-label {
        display: block;
        margin-bottom: 10px;
        color: var(--lime);
      }

      .fact p {
        margin: 0;
        color: #b7ccc5;
        font-size: 14px;
        line-height: 1.55;
      }

      .entry {
        padding: clamp(78px, 9vw, 118px) 0;
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 60px;
        align-items: end;
      }

      .entry h2 {
        margin: 0;
        max-width: 760px;
        font-family: "Space Grotesk", system-ui, sans-serif;
        font-size: clamp(42px, 6vw, 76px);
        font-weight: 600;
        line-height: 0.98;
        letter-spacing: -0.06em;
      }

      .entry-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 10px;
      }

      .button {
        min-height: 48px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        border: 1px solid var(--ink);
        border-radius: 8px;
        padding: 0 18px;
        font-size: 14px;
        font-weight: 750;
        text-decoration: none;
      }

      .button-primary {
        background: var(--ink);
        color: var(--white);
      }

      .button-primary:hover {
        background: var(--jade-dark);
        border-color: var(--jade-dark);
      }

      .button-secondary:hover {
        background: var(--paper-deep);
      }

      footer {
        border-top: 1px solid var(--line);
      }

      .footer-inner {
        min-height: 92px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        color: var(--muted);
        font-size: 13px;
      }

      .footer-links {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 18px;
      }

      .footer-links a {
        text-decoration: none;
      }

      .footer-links a:hover {
        color: var(--ink);
      }

      @media (max-width: 900px) {
        .hero,
        .story-inner,
        .entry {
          grid-template-columns: 1fr;
        }

        .hero {
          gap: 48px;
        }

        .hero-intro {
          max-width: 620px;
        }

        .manifesto-grid,
        .section-head {
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .product {
          grid-template-columns: 58px minmax(190px, 0.7fr) minmax(0, 1.3fr);
          gap: 22px;
        }

        .product-copy {
          grid-template-columns: 1fr;
        }

        .product-copy a {
          width: fit-content;
        }

        .entry-actions {
          justify-content: flex-start;
        }
      }

      @media (max-width: 700px) {
        .shell {
          width: min(100% - 32px, 1240px);
        }

        .nav {
          min-height: 68px;
        }

        .nav-link {
          display: none;
        }

        .nav-chat {
          margin-left: 0;
          min-height: 38px;
          padding: 0 12px;
        }

        .hero {
          padding: 62px 0 52px;
        }

        .hero h1 {
          font-size: clamp(46px, 15vw, 68px);
        }

        .manifesto-grid {
          padding: 24px 0;
        }

        .products {
          padding: 76px 0 86px;
        }

        .product {
          grid-template-columns: 44px minmax(0, 1fr);
          padding: 31px 0 34px;
        }

        .product-copy {
          grid-column: 2;
        }

        .story-inner {
          padding: 74px 0;
        }

        .facts {
          grid-template-columns: 1fr;
        }

        .fact {
          min-height: auto;
          padding: 22px 0;
          border-bottom: 1px solid #34534c;
        }

        .fact + .fact {
          padding-left: 0;
          border-left: 0;
        }

        .entry {
          padding: 76px 0;
        }

        .footer-inner {
          min-height: 118px;
          align-items: flex-start;
          flex-direction: column;
          justify-content: center;
        }

        .footer-links {
          justify-content: flex-start;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        html {
          scroll-behavior: auto;
        }

        *,
        *::before,
        *::after {
          transition-duration: 0.01ms !important;
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
        }
      }
    </style>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>

    <header>
      <div class="shell nav">
        <a href="https://miithii.in/" class="brand" aria-label="Miithii home">
          <svg viewBox="0 0 58 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="4" y="17" width="6" height="14" rx="3" fill="#1d9e75" />
            <rect x="15" y="12" width="6" height="24" rx="3" fill="#1d9e75" />
            <rect x="26" y="6" width="6" height="36" rx="3" fill="#c6ff3d" />
            <rect x="37" y="12" width="6" height="24" rx="3" fill="#1d9e75" />
            <rect x="48" y="17" width="6" height="14" rx="3" fill="#1d9e75" />
          </svg>
          <strong>miithii</strong>
        </a>

        <nav class="nav-group" aria-label="Products">
          <a class="nav-link" href="https://subtitles.miithii.in/">Subtitles</a>
          <a class="nav-link" href="https://voice.miithii.in/">Voice</a>
          <a class="nav-chat" href="https://chat.miithii.in/">Open Chat <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </header>

    <main id="main">
      <section class="shell hero" aria-labelledby="hero-title">
        <div>
          <p class="kicker">Miithii / chat · subtitles · voice</p>
          <h1 id="hero-title">Language tools for <em>real conversations.</em></h1>
        </div>
        <div class="hero-intro">
          <p>
            Miithii is a small set of focused tools for talking, listening, and working with language — starting with Assamese.
          </p>
          <a href="#products">See the products <span aria-hidden="true">↓</span></a>
        </div>
      </section>

      <section class="manifesto" aria-label="Product approach">
        <div class="shell manifesto-grid">
          <strong>One name. Three distinct jobs.</strong>
          <p>
            Chat is for text conversations. Voice is for speaking. Subtitles is for media. We keep the experiences separate so each one can stay simple and honest about what it does today.
          </p>
        </div>
      </section>

      <section class="shell products" id="products" aria-labelledby="products-title">
        <div class="section-head">
          <p class="section-kicker">Products</p>
          <h2 id="products-title">Choose the way you want to work.</h2>
        </div>

        <div class="product-list">
          <article class="product">
            <div class="product-number">01</div>
            <div>
              <h3 class="product-name">Chat</h3>
              <span class="status">Available</span>
            </div>
            <div class="product-copy">
              <p>
                A signed-in text workspace for talking with Miithii. Conversations sync to your account, and useful cross-conversation memory can be switched off in settings.
              </p>
              <a href="https://chat.miithii.in/">Open Chat <span aria-hidden="true">↗</span></a>
            </div>
          </article>

          <article class="product">
            <div class="product-number">02</div>
            <div>
              <h3 class="product-name">Voice</h3>
              <span class="status">Preview</span>
            </div>
            <div class="product-copy">
              <p>
                Tap the mic to speak in Assamese, or hold Space on desktop. Miithii transcribes your clip, replies, and can read the answer aloud. A simple session transcript remains available while you talk.
              </p>
              <a href="https://voice.miithii.in/">Open Voice <span aria-hidden="true">↗</span></a>
            </div>
          </article>

          <article class="product">
            <div class="product-number">03</div>
            <div>
              <h3 class="product-name">Subtitles</h3>
              <span class="status">Prototype</span>
            </div>
            <div class="product-copy">
              <p>
                A workspace for upload, language selection, timecoded review, and caption export. The live transcription and translation pipeline is still being connected.
              </p>
              <a href="https://subtitles.miithii.in/">View prototype <span aria-hidden="true">↗</span></a>
            </div>
          </article>
        </div>
      </section>

      <section class="story" aria-labelledby="story-title">
        <div class="shell story-inner">
          <div>
            <p class="section-kicker">What matters</p>
            <h2 id="story-title">Useful before impressive.</h2>
          </div>
          <div class="story-copy">
            <p>
              Miithii is being built around everyday language use, not a wall of AI features. The current focus is making the Assamese experience dependable, keeping product boundaries clear, and showing what is ready versus experimental.
            </p>
            <div class="facts" aria-label="Current product boundaries">
              <div class="fact">
                <span class="fact-label">Chat</span>
                <p>Sign-in required. The daily allowance is 50 messages per account, resetting at midnight IST.</p>
              </div>
              <div class="fact">
                <span class="fact-label">Voice</span>
                <p>Assamese is the current launch language, using short push-to-talk turns.</p>
              </div>
              <div class="fact">
                <span class="fact-label">Subtitles</span>
                <p>The workspace exists today; the production processing pipeline is not presented as finished.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="shell entry" aria-labelledby="entry-title">
        <h2 id="entry-title">Start with the product you need.</h2>
        <div class="entry-actions">
          <a class="button button-primary" href="https://chat.miithii.in/">Open Chat <span aria-hidden="true">↗</span></a>
          <a class="button button-secondary" href="https://voice.miithii.in/">Try Voice</a>
        </div>
      </section>
    </main>

    <footer>
      <div class="shell footer-inner">
        <div>© 2026 Miithii</div>
        <nav class="footer-links" aria-label="Footer">
          <a href="https://chat.miithii.in/">Chat</a>
          <a href="https://subtitles.miithii.in/">Subtitles</a>
          <a href="https://voice.miithii.in/">Voice</a>
          <a href="https://miithii.in/sitemap.xml">Sitemap</a>
        </nav>
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
    <lastmod>2026-09-09</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://chat.miithii.in/</loc>
    <lastmod>2026-09-09</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://subtitles.miithii.in/</loc>
    <lastmod>2026-09-09</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://voice.miithii.in/</loc>
    <lastmod>2026-09-09</lastmod>
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
