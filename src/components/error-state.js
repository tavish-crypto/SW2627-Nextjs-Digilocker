import Link from "next/link";

export default function RouteErrorState({
  title,
  message,
  onRetry,
  actionHref,
  actionLabel = "Back to Vault",
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-black/10 bg-white p-8 text-center shadow-sm dark:border-white/15 dark:bg-[#0d1117]"
    >
      <h2 className="text-2xl font-semibold tracking-tight text-[#004b87]">{title}</h2>
      <p className="mt-3 text-base text-foreground/75">{message}</p>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#004b87] focus:ring-offset-2"
        >
          Try again
        </button>

        {actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex items-center justify-center rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-[#004b87] hover:text-[#004b87] dark:border-white/15"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
