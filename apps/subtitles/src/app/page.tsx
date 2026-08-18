import { ProductNav, LogoWordmark, StatusBadge } from "@miithii/ui";
import { SubtitleWorkspace } from "./subtitle-workspace";

const navItems = [
  { href: "https://miithii.in", label: "Hub" },
  { href: "https://subtitles.miithii.in", label: "Subtitles", active: true },
  { href: "https://chat.miithii.in", label: "Chat" },
  { href: "https://voice.miithii.in", label: "Voice" }
];

export default function Page() {
  return (
    <div className="subtitles-shell">
      <header className="subtitles-header">
        <LogoWordmark />
        <ProductNav items={navItems} />
      </header>
      <main className="subtitles-main">
        <aside className="subtitles-sidebar">
          <StatusBadge tone="accent">Subtitles first</StatusBadge>
          <section className="sidebar-section">
            <h2>Recent jobs</h2>
            <div className="job-list">
              <div className="job-row">
                <strong>Assamese lab note</strong>
                <span>00:06:42 - draft</span>
              </div>
              <div className="job-row">
                <strong>Product demo clip</strong>
                <span>00:01:18 - ready</span>
              </div>
              <div className="job-row">
                <strong>Voice sample</strong>
                <span>00:00:54 - queued</span>
              </div>
            </div>
          </section>
        </aside>
        <SubtitleWorkspace />
      </main>
    </div>
  );
}

