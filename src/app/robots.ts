import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/crm", "/portal", "/api", "/login", "/auth", "/no-access", "/reset-password"] }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
