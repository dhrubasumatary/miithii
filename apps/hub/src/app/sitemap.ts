import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-18T00:00:00.000Z");

  return [
    {
      url: "https://miithii.in",
      lastModified,
      changeFrequency: "weekly",
      priority: 1
    }
  ];
}
