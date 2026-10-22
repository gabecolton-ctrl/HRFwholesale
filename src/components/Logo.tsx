import Link from "next/link";

export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="H.R.F Assets LLC home">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill={light ? "#ffffff" : "#13283d"} />
        <path d="M9.5 15 16 9.8l6.5 5.2v9.5h-13z" fill={light ? "#13283d" : "#ffffff"} />
        <path d="M6 16 16 7.8 26 16" fill="none" stroke="#b4502b" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14.2" y="18.5" width="3.6" height="6" fill={light ? "#ffffff" : "#13283d"} />
      </svg>
      <span className={`leading-tight ${light ? "text-white" : "text-ink"}`}>
        <span className="h-display block text-base font-semibold whitespace-nowrap sm:text-lg">H.R.F Assets LLC</span>
        <span className={`block text-[11px] font-medium tracking-wide uppercase ${light ? "text-white/70" : "text-ink-soft"}`}>
          Cash home buyers · Nationwide
        </span>
      </span>
    </Link>
  );
}
