import Link from "next/link";

export const metadata = {
  title: "403 Forbidden | DigiLocker",
  description: "You do not have permission to access this resource.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <main className="w-full max-w-md space-y-6 rounded-xl border border-black/10 bg-background p-8 text-center shadow-sm dark:border-white/15">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
          <svg
            className="h-7 w-7 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">403 - Access Denied</h1>
          <p className="text-sm text-foreground/75">
            You are signed in, but your account does not have the required permissions to access this privileged area.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/dashboard"
            className="rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Return to Dashboard
          </Link>
          <Link
            href="/documents"
            className="rounded-md border border-black/10 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            View My Documents
          </Link>
        </div>
      </main>
    </div>
  );
}
