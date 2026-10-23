"use client";
import { useEffect } from "react";

/** Supabase's default emails can land on any page with the login tokens after "#". Send them to the handler. */
export function AuthHashForwarder() {
  useEffect(() => {
    const h = window.location.hash;
    if (window.location.pathname !== "/auth/accept" && /(access_token|error_code)=/.test(h)) {
      window.location.replace(`/auth/accept${h}`);
    }
  }, []);
  return null;
}
