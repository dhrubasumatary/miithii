import { getProductLinks, ProductDock, ProductLink } from "@miithii/ui";

const products = getProductLinks(["chat", "voice", "subtitles"]);

const productCopy = {
  chat: {
    eyebrow: "Text",
    title: "Talk naturally.",
    body: "A quiet workspace for longer conversations, memory, and everyday questions."
  },
  voice: {
    eyebrow: "Voice",
    title: "Speak instead.",
    body: "Press, talk, and hear Miithii answer back in Assamese."
  },
  subtitles: {
    eyebrow: "Subtitles",
    title: "Subtitle your content.",
    body: "Assamese captions for reels, podcasts, and shorts. Join the launch list."
  }
} as const;

export default function Page() {
  return (
    <main className="hub-page" aria-label="Miithii home">
      <ProductDock active="home" />

      <section className="hub-hero" id="top" aria-labelledby="hub-title">
        <div className="hub-hero__copy">
          <p className="hub-kicker">Assamese, on your terms.</p>
          <h1 id="hub-title">How do you want to talk?</h1>
          <p className="hub-intro">
            One Miithii across text and voice, with Assamese speech tools on the way. Pick a mode and get straight to it.
          </p>
          <div className="hub-hero__actions">
            <ProductLink className="hub-cta hub-cta--primary" product="chat">Start chatting <span aria-hidden="true">→</span></ProductLink>
            <ProductLink className="hub-cta" product="voice">Talk with voice</ProductLink>
          </div>
        </div>
        <div className="hub-orbit" aria-hidden="true">
          <span className="hub-orbit__ring" />
          <span className="hub-orbit__ring hub-orbit__ring--two" />
          <span className="hub-orbit__core" />
        </div>
      </section>

      <section className="hub-products" aria-label="Product surfaces">
        {products.map((product, index) => {
          const copy = productCopy[product.key as keyof typeof productCopy];
          return (
            <ProductLink className="hub-product" product={product.key} key={product.key}>
              <div className="hub-product__index">0{index + 1}</div>
              <div className="hub-product__copy">
                <span className="hub-product__eyebrow">{copy.eyebrow}</span>
                <h2>{copy.title}</h2>
                <p>{copy.body}</p>
                <span className="hub-product__action">
                  {product.key === "subtitles" ? "Join the waitlist" : `Open ${product.label}`}
                </span>
              </div>
              <span className="hub-product__arrow" aria-hidden="true">↗</span>
            </ProductLink>
          );
        })}
      </section>

      <footer className="hub-footer">
        <span>Miithii</span>
        <span>Built for everyday Assamese conversation.</span>
      </footer>
    </main>
  );
}
