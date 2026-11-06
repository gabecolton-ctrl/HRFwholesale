"use client";
import { Analytics } from "@vercel/analytics/next";

/** Counts public page visits only; CRM, portal and login pages are never sent. */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(e) => {
        const path = new URL(e.url).pathname;
        return /^\/(crm|portal|auth|login|reset-password|no-access|api|alerts)(\/|$)/.test(path) ? null : e;
      }}
    />
  );
}
