import Link from "next/link";
import VaultNavigation from "./vault-navigation";

export default function VaultLayout({ children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="vault-header border-b border-[#d8e3ef]">
        <div className="gov-strip" aria-hidden="true" />
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link className="flex items-center gap-3" href="/dashboard">
            <span className="brand-mark" aria-hidden="true">DL</span>
            <span>
              <span className="block text-lg font-bold tracking-tight text-[#004b87]">DigiLocker</span>
              <span className="block text-[0.68rem] font-medium uppercase tracking-[0.12em] text-[#62738a]">Secure document vault</span>
            </span>
          </Link>
          <VaultNavigation />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
