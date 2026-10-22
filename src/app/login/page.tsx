import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <h1 className="h-display mb-1 text-center text-3xl font-semibold">Sign in</h1>
        <p className="mb-6 text-center text-sm text-ink-soft">Team members and registered buyers.</p>
        {error === "config" ? (
          <p className="mb-4 rounded-lg bg-danger/5 px-3 py-2 text-center text-sm text-danger">Sign-in isn't connected yet: the Supabase keys are missing or wrong in Vercel.</p>
        ) : error ? (
          <p className="mb-4 rounded-lg bg-danger/5 px-3 py-2 text-center text-sm text-danger">That link has expired. Sign in or request a new one.</p>
        ) : null}
        <LoginForm next={next} />
        <p className="mt-6 text-center text-sm text-ink-soft">
          Investor? <Link href="/buyers" className="font-semibold text-ink underline">Join the buyers list</Link>
        </p>
      </div>
    </main>
  );
}
