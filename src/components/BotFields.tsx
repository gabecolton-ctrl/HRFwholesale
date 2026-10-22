"use client";
import { useState } from "react";

/** Hidden honeypot + fill-time stamp used by the public forms' bot filter. */
export function BotFields() {
  const [startedAt] = useState(() => Date.now());
  return (
    <>
      <input type="hidden" name="started_at" value={startedAt} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this empty
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
    </>
  );
}
