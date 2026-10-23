import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 1) Two domains, one site:
//    - Seller domain (NEXT_PUBLIC_SELLER_URL, e.g. hrfassets.com): "We buy houses" pages.
//    - App domain (NEXT_PUBLIC_SITE_URL, e.g. hrfwholesale.com): investor homepage,
//      buyer portal, CRM and logins (logins live on ONE domain so sessions stay simple).
//    Any other host (like *.vercel.app) serves everything, as before.
// 2) Refreshes the login session and keeps signed-out visitors out of the CRM and
//    portal. Role checks happen in the pages and, more importantly, in the database.

const hostOf = (u?: string | null) => {
  try {
    return u ? new URL(u).host.replace(/^www\./, "").toLowerCase() : null;
  } catch {
    return null;
  }
};

const APP_ONLY = ["/crm", "/portal", "/login", "/auth", "/reset-password", "/no-access", "/buyers", "/alerts", "/api"];
const SELLER_ONLY = ["/sell", "/about", "/contact"];
const under = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(p + "/"));

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const host = (request.headers.get("host") ?? "").replace(/^www\./, "").toLowerCase();
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const sellerUrl = process.env.NEXT_PUBLIC_SELLER_URL;
  const appHost = hostOf(appUrl);
  const sellerHost = hostOf(sellerUrl);
  const split = Boolean(appHost && sellerHost && appHost !== sellerHost);

  const go = (base: string) => {
    const url = new URL(path + request.nextUrl.search, base);
    return NextResponse.redirect(url, 308);
  };

  // Tell the public pages which audience they're serving (changes header/footer).
  const headers = new Headers(request.headers);
  let audience: "seller" | "investor" = "seller";

  if (split && host === sellerHost) {
    if (under(path, APP_ONLY)) return go(appUrl!);
    headers.set("x-hrf-audience", "seller");
    return NextResponse.next({ request: { headers } });
  }
  if (split && host === appHost) {
    if (under(path, SELLER_ONLY)) return go(sellerUrl!);
    audience = "investor";
    if (path === "/") {
      headers.set("x-hrf-audience", "investor");
      return NextResponse.rewrite(new URL("/buyers" + request.nextUrl.search, request.url), { request: { headers } });
    }
  }
  headers.set("x-hrf-audience", audience);

  // Session handling only where logins matter.
  if (!under(path, ["/crm", "/portal", "/api", "/login", "/auth"])) {
    return NextResponse.next({ request: { headers } });
  }

  const isPrivate = under(path, ["/crm", "/portal", "/api/export", "/api/files"]);
  const toLogin = (reason?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}${reason ? `&error=${reason}` : ""}`;
    return NextResponse.redirect(url);
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase environment variables are missing");
    return isPrivate ? toLogin("config") : NextResponse.next({ request: { headers } });
  }

  let response = NextResponse.next({ request: { headers } });
  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Rebuild from the request so refreshed session cookies reach the page in this same request.
          const fresh = new Headers(request.headers);
          fresh.set("x-hrf-audience", audience);
          response = NextResponse.next({ request: { headers: fresh } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (isPrivate && !user) return toLogin();
    return response;
  } catch (e) {
    console.error("Session check failed", e);
    return isPrivate ? toLogin("config") : NextResponse.next({ request: { headers } });
  }
}

export const config = {
  // Everything except static files, images and icons.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)"],
};
