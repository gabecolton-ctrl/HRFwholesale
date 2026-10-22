import Link from "next/link";
export const metadata = { title: "Check your email", robots: { index: false } };
export default function Thanks() {
  return (
    <section className="container-x max-w-2xl py-20 text-center">
      <h1 className="h-display text-4xl font-semibold">You're on the list. One last step.</h1>
      <p className="mt-4 text-lg text-ink-soft">
        We sent you an email to confirm your address. Click the link in it, then sign in to see your buyer portal. Didn't
        get it? Check spam, or wait a minute and try signing in.
      </p>
      <Link href="/login" className="btn btn-primary mt-8">Go to sign in</Link>
    </section>
  );
}
