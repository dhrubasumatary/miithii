import { ProductDock, ProductLink } from "@miithii/ui";

const products = [
  {
    key: "chat" as const,
    label: "Chat",
    detail: "Write, ask, think, or just talk. Sign in once and keep your conversations with you.",
    meta: "50 messages / day"
  },
  {
    key: "voice" as const,
    label: "Voice",
    detail: "Speak in Assamese or Bodo. Pause when you’re done and Miithii replies out loud.",
    meta: "Assamese · Bodo"
  },
  {
    key: "subtitles" as const,
    label: "Subtitles",
    detail: "Assamese captions for video and audio. Join the launch list while we finish the pipeline.",
    meta: "Waitlist · no account"
  }
];

export default function Page() {
  return (
    <main className="hub-page" aria-label="Miithii home">
      <ProductDock active="home" />

      <section className="hub-launcher" aria-labelledby="hub-title">
        <header className="hub-intro">
          <p className="hub-pronunciation">Miithii <span>/ˈmiː.θiː/</span> · MEE-thee</p>
          <h1 id="hub-title">Choose how you want to talk.</h1>
          <p className="hub-summary">Chat, voice, and subtitles for everyday Assamese and Bodo use.</p>
        </header>

        <div className="hub-products" aria-label="Miithii products">
          {products.map((product) => (
            <ProductLink className="hub-product" product={product.key} key={product.key}>
              <div className="hub-product__top">
                <h2>{product.label}</h2>
                <span aria-hidden="true">↗</span>
              </div>
              <p>{product.detail}</p>
              <small>{product.meta}</small>
            </ProductLink>
          ))}
        </div>
      </section>
    </main>
  );
}
