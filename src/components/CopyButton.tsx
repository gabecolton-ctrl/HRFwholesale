"use client";
import { useState } from "react";
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-ghost btn-sm" disabled={!text}
      onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? "Copied" : label}
    </button>
  );
}
