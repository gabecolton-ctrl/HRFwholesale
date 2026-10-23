import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { Accept } from "./Accept";

export const metadata = { title: "Signing you in", robots: { index: false } };

export default function AcceptPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <div className="card mt-8 w-full max-w-md p-6">
        <Suspense fallback={<p className="text-ink-soft">Checking your link…</p>}>
          <Accept />
        </Suspense>
      </div>
    </main>
  );
}
