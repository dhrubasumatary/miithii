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
  { href: "https://chat.miithii.in", label: "Chat", active: true },
  { href: "https://voice.miithii.in", label: "Voice" }
];

export default function Page() {
  return (
    <ProductShell className="mini-app">
      <ProductHeader>
        <LogoWordmark />
        <ProductNav items={navItems} />
      </ProductHeader>
      <ProductMain className="mini-app__main">
        <Card>
          <CardHeader>
            <StatusBadge tone="warning">Shell</StatusBadge>
            <CardTitle className="mini-app__title">Miithii Chat</CardTitle>
            <CardDescription>
              Chat will inherit auth, memory, billing, and the LLM router after subtitles proves the pattern.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="composer">Ask Miithii anything...</div>
          </CardContent>
        </Card>
      </ProductMain>
    </ProductShell>
  );
}
