"use client";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial, sans-serif", background: "#f7f4ee", color: "#13283d", padding: "48px 16px", textAlign: "center" }}>
        <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
        <p style={{ fontSize: 14 }}>Reload the page. If it keeps happening, screenshot this and send it over.</p>
        <pre style={{ display: "inline-block", maxWidth: "100%", whiteSpace: "pre-wrap", textAlign: "left", fontSize: 12, background: "#fff", border: "1px solid #e3ddd2", borderRadius: 8, padding: "8px 12px" }}>
          {error.message || "Unknown error"}{error.digest ? `\nRef: ${error.digest}` : ""}
        </pre>
        <p><button onClick={() => window.location.reload()} style={{ background: "#b4502b", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: "bold" }}>Reload page</button></p>
      </body>
    </html>
  );
}
