"use client";

import { useEffect } from "react";

/** Friendly error screen with the actual message, so problems can be diagnosed from a screenshot. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = /Server Action|ChunkLoadError|Loading chunk|dynamically imported module/i.test(error.message);
  useEffect(() => {
    console.error(error);
    // After a new deploy, an open tab can point at old code. One automatic reload fixes it.
    if (stale && typeof window !== "undefined" && !sessionStorageGet("hrf_reloaded")) {
      sessionStorageSet("hrf_reloaded", "1");
      window.location.reload();
    }
  }, [error, stale]);

  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-4 py-10 text-center">
      <h1 className="h-display mb-2 text-2xl font-semibold">Something went wrong</h1>
      <p className="mb-4 max-w-md text-sm text-ink-soft">
        {stale ? "The site was just updated. Reload the page to get the newest version." : "Try again. If it keeps happening, screenshot this box and send it over."}
      </p>
      <pre className="mb-5 max-w-full overflow-x-auto rounded-lg border border-line bg-white px-3 py-2 text-left text-xs whitespace-pre-wrap text-ink-soft">
        {error.message || "Unknown error"}{error.digest ? `\nRef: ${error.digest}` : ""}
      </pre>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
        <button className="btn btn-ghost" onClick={() => reset()}>Try again</button>
      </div>
    </main>
  );
}

function sessionStorageGet(k: string) {
  try { return window.sessionStorage.getItem(k); } catch { return null; }
}
function sessionStorageSet(k: string, v: string) {
  try { window.sessionStorage.setItem(k, v); } catch {}
}
