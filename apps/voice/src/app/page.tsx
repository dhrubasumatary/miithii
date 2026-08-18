import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  LogoWordmark,
  ProductHeader,
  ProductMain,
  ProductNav,
  ProductShell,
  StatusBadge
} from "@miithii/ui";

const navItems = [
  { href: "https://miithii.in", label: "Hub" },
  { href: "https://subtitles.miithii.in", label: "Subtitles" },
  { href: "https://chat.miithii.in", label: "Chat" },
  { href: "https://voice.miithii.in", label: "Voice", active: true }
];

export default function Page() {
  return (
    <ProductShell className="voice-shell">
      <ProductHeader>
        <LogoWordmark />
        <ProductNav items={navItems} />
      </ProductHeader>
      <ProductMain className="voice-console">
        <StatusBadge tone="warning">Shell</StatusBadge>
        <section className="voice-console__main">
          <Card>
            <CardHeader>
              <CardTitle className="voice-title">Miithii Voice</CardTitle>
              <CardDescription>
                Voice will reuse the same auth, memory, billing, and provider routing boundaries.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card aria-label="Voice level">
            <CardContent>
              <div className="level-meter" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </CardContent>
          </Card>
        </section>
      </ProductMain>
    </ProductShell>
  );
}
