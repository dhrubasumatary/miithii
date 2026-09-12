import { ProductDock, ProductLink } from "@miithii/ui";

export default function Page() {
  return (
    <main className="hub-page" aria-label="Miithii home">
      <ProductDock active="home" />

      <section className="hub-home" aria-labelledby="hub-title">
        <header className="hub-hero">
          <p className="hub-live"><span aria-hidden="true" /> Assamese + Bodo live</p>
          <h1 id="hub-title">Talk to Miithii.</h1>
          <p className="hub-lede">
            Write what you&apos;re thinking or just speak. Miithii can answer in Assamese and Bodo.
          </p>
        </header>

        <section className="hub-console" aria-label="Choose a Miithii product">
          <div className="hub-languages" aria-label="Available languages">
            <div className="hub-language">
              <span className="hub-language__script">অসমীয়া</span>
              <span className="hub-language__meta">Assamese</span>
            </div>
            <span className="hub-language__plus" aria-hidden="true">+</span>
            <div className="hub-language">
              <span className="hub-language__script hub-language__script--bodo">बड़ो</span>
              <span className="hub-language__meta">Bodo</span>
            </div>
          </div>

          <div className="hub-actions">
            <ProductLink product="chat" className="hub-action">
              <span className="hub-action__copy">
                <strong>Chat</strong>
                <small>Ask, write, think. Useful context stays with you.</small>
              </span>
              <span className="hub-action__go" aria-hidden="true">↗</span>
            </ProductLink>

            <ProductLink product="voice" className="hub-action hub-action--primary">
              <span className="hub-action__copy">
                <strong>Voice</strong>
                <small>Speak naturally. Choose the language Miithii replies in.</small>
              </span>
              <span className="hub-action__go" aria-hidden="true">↗</span>
            </ProductLink>
          </div>

          <p className="hub-signin-note">Sign in once · 50 messages/day across Chat + Voice</p>
        </section>

        <footer className="hub-footer">
          <ProductLink product="subtitles" className="hub-subtitles">
            <strong>Subtitles</strong>
            <span>Assamese captions · waitlist</span>
            <b aria-hidden="true">↗</b>
          </ProductLink>
          <p className="hub-next"><span>Next</span> Mising · Manipuri · Karbi · Dimasa</p>
        </footer>
      </section>
    </main>
  );
}
