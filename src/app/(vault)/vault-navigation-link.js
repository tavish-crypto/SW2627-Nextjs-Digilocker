"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function VaultNavigationLink({ href, children }) {
  const isActive = usePathname() === href;

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-[#0066b3] text-white shadow-sm"
          : "text-[#48617d] hover:bg-[#e5f2fc] hover:text-[#004b87]"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}
