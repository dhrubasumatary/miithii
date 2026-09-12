export type ProductKey = "home" | "chat" | "voice" | "subtitles";

export type ProductLink = {
  key: ProductKey;
  label: string;
  href: string;
};

const productionUrls: Record<ProductKey, string> = {
  home: "https://miithii.in",
  chat: "https://chat.miithii.in",
  voice: "https://voice.miithii.in",
  subtitles: "https://subtitles.miithii.in"
};

const localUrls: Record<ProductKey, string> = {
  home: "http://localhost:3000",
  chat: "http://localhost:3002",
  voice: "http://localhost:3003",
  subtitles: "http://localhost:3001"
};

export const productLabels: Record<ProductKey, string> = {
  home: "Home",
  chat: "Chat",
  voice: "Voice",
  subtitles: "Subtitles"
};

export function getProductUrl(product: ProductKey) {
  return process.env.NODE_ENV === "development" ? localUrls[product] : productionUrls[product];
}

export function getProductLinks(products: ProductKey[]): ProductLink[] {
  return products.map((key) => ({
    key,
    label: productLabels[key],
    href: getProductUrl(key)
  }));
}
