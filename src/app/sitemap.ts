import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { CITIES, SITUATIONS } from "@/lib/seo-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const seller = (site.sellerUrl ?? site.url).replace(/\/$/, "");
  const app = site.url.replace(/\/$/, "");
  return [
    ...["", "/sell", "/about", "/contact", "/privacy", "/terms"].map((p) => ({
      url: `${seller}${p}`,
      changeFrequency: "monthly" as const,
      priority: p === "" ? 1 : p === "/sell" ? 0.9 : 0.5,
    })),
    { url: `${seller}/situations`, changeFrequency: "monthly" as const, priority: 0.7 },
    ...SITUATIONS.map((x) => ({ url: `${seller}/situations/${x.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${seller}/we-buy-houses`, changeFrequency: "monthly" as const, priority: 0.7 },
    ...CITIES.map((x) => ({ url: `${seller}/we-buy-houses/${x.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: site.sellerUrl ? `${app}/` : `${app}/buyers`, changeFrequency: "monthly" as const, priority: 0.7 },
  ];
}
