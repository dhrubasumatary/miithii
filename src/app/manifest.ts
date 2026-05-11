import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: "/voice",
    scope: "/",
    display: "standalone",
    background_color: "#f6f5ef",
    theme_color: "#30D158",
    categories: ["business", "multimedia", "productivity"],
    icons: [
      {
        src: "/brand/miithii-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icon",
        sizes: "1024x1024",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
