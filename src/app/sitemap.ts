import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/sell", "/about", "/contact", "/buyers", "/privacy", "/terms"].map((p) => ({
    url: `${site.url}${p}`,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : p === "/sell" ? 0.9 : 0.5,
  }));
}
