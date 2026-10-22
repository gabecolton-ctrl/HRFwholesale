import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Waiting for access", robots: { index: false } };

export default async function NoAccess() {
  const { user } = await getSession();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <h1 className="h-display mt-8 text-3xl font-semibold">Your account is waiting for access</h1>
      <p className="mt-3 max-w-md text-ink-soft">
        {user ? `You're signed in as ${user.email}. ` : ""}The owner needs to assign you a role before you can use the CRM.
      </p>
      <form action="/auth/signout" method="post" className="mt-6"><button className="btn btn-ghost">Sign out</button></form>
    </main>
  );
}
