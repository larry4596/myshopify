"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import AuthMenu from "@/components/AuthMenu";
import CartNavLink from "@/components/CartNavLink";

/**
 * Site header.
 *
 * Phase 1: static navigation + placeholder sign-in button.
 * Phase 2: AuthMenu (client) shows real Google sign-in / avatar + sign out.
 * Phase 4: "Cart" carries a live item-count badge (CartNavLink).
 */

const navLinks: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/#menu", label: "Menu" },
  { href: "/orders", label: "Orders" },
];

/** The Cart entry needs live cart state, so it's rendered separately. */
function NavItem({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="transition-colors hover:text-brand">
      {children}
    </Link>
  );
}

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="text-2xl font-extrabold tracking-tight text-brand"
        >
          Naija<span className="text-gold">Bites</span>
        </Link>

        {/* Desktop navigation */}
        <nav
          className="hidden items-center gap-6 text-sm font-medium text-ink/70 sm:flex"
          aria-label="Primary"
        >
          {navLinks.map((link) => (
            <NavItem key={link.href} href={link.href}>
              {link.label}
            </NavItem>
          ))}
          <CartNavLink />
        </nav>

        {/* Actions — real auth state (Phase 2) */}
        <div className="flex items-center gap-3">
          <AuthMenu />
        </div>
      </div>

      {/* Mobile navigation (second row, shown below the sm breakpoint) */}
      <nav
        className="flex justify-center gap-6 border-t border-black/5 py-2 text-sm font-medium text-ink/70 sm:hidden"
        aria-label="Mobile"
      >
        {navLinks.map((link) => (
          <NavItem key={link.href} href={link.href}>
            {link.label}
          </NavItem>
        ))}
        <CartNavLink />
      </nav>
    </header>
  );
}
