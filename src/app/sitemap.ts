import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return ["", "/voice", "/pricing", "/contact", "/terms", "/refund"].map((path) => ({
    url: siteUrl(path || "/"),
    lastModified,
    changeFrequency: path === "" || path === "/voice" ? "daily" : "monthly",
    priority: path === "" || path === "/voice" ? 1 : 0.7,
  }));
}
