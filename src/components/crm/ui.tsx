import Link from "next/link";

export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="h-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const leadColors: Record<string, string> = {
  New: "bg-clay/10 text-clay",
  Contacted: "bg-ink/10 text-ink",
  "Follow up": "bg-amber/15 text-amber",
  "Appointment set": "bg-sky-100 text-sky-800",
  "Offer made": "bg-violet-100 text-violet-800",
  "Under contract": "bg-sage/15 text-sage",
  Closed: "bg-sage text-white",
  Dead: "bg-gray-100 text-gray-500",
  Marketing: "bg-amber/15 text-amber",
  "Buyer assigned": "bg-sky-100 text-sky-800",
  "Clear to close": "bg-violet-100 text-violet-800",
  Cancelled: "bg-gray-100 text-gray-500",
};

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${leadColors[status] ?? "bg-gray-100 text-gray-600"}`}>{status}</span>;
}

export function Flag({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "danger" | "sage" | "amber" | "clay" }) {
  const t = {
    ink: "bg-ink/10 text-ink",
    danger: "bg-danger/10 text-danger",
    sage: "bg-sage/15 text-sage",
    amber: "bg-amber/15 text-amber",
    clay: "bg-clay/10 text-clay",
  }[tone];
  return <span className={`pill ${t}`}>{children}</span>;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "sage", children }: { tone?: "sage" | "danger" | "amber"; children: React.ReactNode }) {
  const t = { sage: "bg-sage/10 text-sage", danger: "bg-danger/5 text-danger border border-danger/20", amber: "bg-amber/10 text-amber" }[tone];
  return <p role={tone === "danger" ? "alert" : "status"} className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${t}`}>{children}</p>;
}

export function Stat({ label, value, href, tone }: { label: string; value: React.ReactNode; href?: string; tone?: "danger" | "clay" }) {
  const body = (
    <>
      <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</p>
      <p className={`h-display mt-1 text-3xl font-semibold ${tone === "danger" ? "text-danger" : tone === "clay" ? "text-clay" : ""}`}>{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 hover:border-ink-soft">{body}</Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

/** Builds ?a=1&b=2 from current params with overrides (null removes). */
export function qs(base: Record<string, string | undefined>, over: Record<string, string | null | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}
