import { ProductDock } from "@miithii/ui";
import type { CSSProperties } from "react";
import { WaitlistForm } from "./waitlist-form";

const rotatingWords = ["Instagram reels", "podcasts", "shorts"];

export default function Page() {
  return (
    <main className="subtitles-waitlist" aria-labelledby="subtitles-title">
      <ProductDock active="subtitles" />

      <section className="subtitles-hero">
        <div className="subtitles-wave" aria-hidden="true">
          {Array.from({ length: 19 }, (_, index) => <span key={index} />)}
        </div>

        <p className="subtitles-kicker">Subtitles · coming soon</p>
        <h1 id="subtitles-title">
          Assamese subtitles for your
          <span className="subtitles-rotator" aria-label="Instagram reels, podcasts, or shorts">
            {rotatingWords.map((word, index) => (
              <span key={word} style={{ "--word-index": index } as CSSProperties}>{word}</span>
            ))}
          </span>
        </h1>
        <p className="subtitles-intro">
          Turn spoken Assamese into clean captions you can review, edit, and publish without fighting the language.
        </p>

        <WaitlistForm />
        <p className="subtitles-note">No account needed. No spam. We&apos;ll email you when the first usable build is ready.</p>
      </section>

      <footer className="subtitles-footer">
        <span>Miithii Subtitles</span>
        <span>Built for Assamese creators.</span>
      </footer>
    </main>
  );
}
