import Link from "next/link";
import { site } from "@/lib/site";

export const metadata = { title: "Thank you", robots: { index: false } };

export default function Thanks() {
  return (
    <section className="container-x max-w-2xl py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/15 text-sage">
        <svg viewBox="0 0 20 20" className="h-7 w-7" aria-hidden><path fill="currentColor" d="M8.1 13.6 4.5 10l1.1-1.1 2.5 2.5 6.3-6.3 1.1 1.1z" /></svg>
      </div>
      <h1 className="h-display mt-6 text-4xl font-semibold">Thanks, we got it.</h1>
      <p className="mt-4 text-lg text-ink-soft">
        Someone from our team will call you shortly to learn a bit more about the house. If it's urgent, call us at{" "}
        <a href={site.phoneHref} className="font-semibold text-ink underline">{site.phone}</a>.
      </p>
      <Link href="/" className="btn btn-ghost mt-8">Back to home</Link>
    </section>
  );
}
