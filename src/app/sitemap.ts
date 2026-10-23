import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const seller = (site.sellerUrl ?? site.url).replace(/\/$/, "");
  const app = site.url.replace(/\/$/, "");
  return [
    ...["", "/sell", "/about", "/contact", "/privacy", "/terms"].map((p) => ({
      url: `${seller}${p}`,
      changeFrequency: "monthly" as const,
      priority: p === "" ? 1 : p === "/sell" ? 0.9 : 0.5,
    })),
    { url: site.sellerUrl ? `${app}/` : `${app}/buyers`, changeFrequency: "monthly" as const, priority: 0.7 },
  ];
}
