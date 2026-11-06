import { site } from "@/lib/site";

export const sellerBase = () => (site.sellerUrl ?? site.url).replace(/\/$/, "");

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.legalName,
    url: sellerBase(),
    logo: `${sellerBase()}/apple-icon.png`,
    telephone: site.phone,
    email: site.email,
    areaServed: { "@type": "Country", name: "United States" },
    address: {
      "@type": "PostalAddress",
      postOfficeBoxNumber: "1440",
      addressLocality: "Prosper",
      addressRegion: "TX",
      postalCode: "75078",
      addressCountry: "US",
    },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${sellerBase()}${it.path}` })),
  };
}
