import Link from "next/link";

export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="H.R.F Assets LLC home">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill={light ? "#ffffff" : "#13283d"} />
        <path d="M7 16.5 16 9l9 7.5" fill="none" stroke="#b4502b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.5 15v8h11v-8" fill="none" stroke={light ? "#13283d" : "#ffffff"} strokeWidth="2.2" strokeLinejoin="round" />
        <rect x="14.3" y="18" width="3.4" height="5" fill={light ? "#13283d" : "#ffffff"} />
      </svg>
      <span className={`leading-tight ${light ? "text-white" : "text-ink"}`}>
        <span className="h-display block text-base font-semibold whitespace-nowrap sm:text-lg">H.R.F Assets LLC</span>
        <span className={`block text-[11px] font-medium tracking-wide uppercase ${light ? "text-white/70" : "text-ink-soft"}`}>
          Dallas–Fort Worth
        </span>
      </span>
    </Link>
  );
}
