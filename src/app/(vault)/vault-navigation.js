import VaultNavigationLink from "./vault-navigation-link";
import { logout } from "../(auth)/actions.js";

const navigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/documents", label: "Documents" },
];

export default function VaultNavigation() {
  return (
    <nav aria-label="Vault navigation">
      <ul className="flex items-center gap-1">
        {navigationItems.map(({ href, label }) => (
          <li key={href}>
            <VaultNavigationLink href={href}>{label}</VaultNavigationLink>
          </li>
        ))}
        <li>
          <form action={logout} className="inline">
            <button className="rounded-md px-3 py-2 text-sm font-medium text-[#62738a] hover:bg-[#fff4e8] hover:text-[#b45309]" type="submit">
              Sign out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
