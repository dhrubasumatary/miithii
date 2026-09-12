import { ProductDock, ProductLink } from "@miithii/ui";

const products = [
  {
    key: "chat" as const,
    label: "Chat",
    detail: "Write, think, ask, or continue something from earlier.",
    meta: "context follows"
  },
  {
    key: "voice" as const,
    label: "Voice",
    detail: "Speak naturally. Choose the language Miithii answers in.",
    meta: "অসমীয়া · बड़ो"
  },
  {
    key: "subtitles" as const,
    label: "Subtitles",
    detail: "Turn Assamese speech into captions for video and audio.",
    meta: "waitlist"
  }
];

export default function Page() {
  return (
    <main className="hub-page" aria-label="Miithii home">
      <ProductDock active="home" />

      <section className="hub-launcher" aria-labelledby="hub-title">
        <div className="hub-hero">
          <header className="hub-intro">
            <p className="hub-pronunciation">Miithii <span>/ˈmiː.θiː/</span> · MEE-thee</p>
            <span className="hub-kicker">A language layer for intelligence</span>
            <h1 id="hub-title">
              <span>Talk to</span>{" "}
              <span>intelligence</span>{" "}
              <span>in your language.</span>
            </h1>
            <p className="hub-summary">
              Write or speak naturally. Miithii carries useful context forward and lets intelligence meet you in the language that fits.
            </p>
            <div className="hub-language-status" aria-label="Language availability">
              <span>Now</span>
              <strong>Assamese · Bodo</strong>
              <span>Next</span>
              <p>Mising · Manipuri · Karbi · Dimasa · more</p>
            </div>
          </header>

          <div className="hub-language-field" aria-label="Miithii language layer">
            <span className="hub-language-field__label">you</span>
            <div className="hub-language-field__input">
              <span>English</span>
              <span>অসমীয়া</span>
              <span>बड़ो</span>
              <span className="is-future">more</span>
            </div>
            <div className="hub-language-field__rail" aria-hidden="true"><i /><i /><i /></div>
            <div className="hub-language-field__core">
              <strong>miithii</strong>
              <span>context follows</span>
            </div>
            <div className="hub-language-field__rail hub-language-field__rail--out" aria-hidden="true"><i /><i /><i /></div>
            <div className="hub-language-field__output">
              <span>অসমীয়া</span>
              <span>बड़ो</span>
            </div>
            <span className="hub-language-field__label">reply</span>
          </div>
        </div>

        <div className="hub-modes" aria-label="Choose a Miithii product">
          <div className="hub-modes__header">
            <span>Start with</span>
            <small>one account · one context</small>
          </div>
          {products.map((product, index) => (
            <ProductLink className="hub-mode" product={product.key} key={product.key}>
              <span className="hub-mode__index">0{index + 1}</span>
              <h2>{product.label}</h2>
              <p>{product.detail}</p>
              <small>{product.meta}</small>
              <span className="hub-mode__arrow" aria-hidden="true">↗</span>
            </ProductLink>
          ))}
        </div>
      </section>
    </main>
  );
}
