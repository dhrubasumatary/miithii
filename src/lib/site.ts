export const siteConfig = {
  name: "Miithii Voice",
  shortName: "Miithii",
  tagline: "Assamese and Northeast voiceovers in seconds.",
  description:
    "Paste Assamese, Bodo, Manipuri, Bengali, Hindi, English, or mixed regional text. Miithii detects the language and renders a downloadable voice file for reels, lessons, ads, and local content.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  supportEmail: "support@miithii.com",
};

export function siteUrl(path = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteConfig.url}${normalizedPath}`;
}
