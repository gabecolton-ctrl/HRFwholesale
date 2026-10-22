import Link from "next/link";
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <h1 className="h-display text-4xl font-semibold">Page not found</h1>
      <p className="mt-3 text-ink-soft">It may have moved, or you may not have access to it.</p>
      <Link href="/" className="btn btn-dark mt-6">Go home</Link>
    </main>
  );
}
