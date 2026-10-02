import Link from "next/link";

/**
 * Site footer — brand summary + quick links.
 * Styled with the dark green background and cream text from the brand theme.
 */

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/#menu", label: "Menu" },
  { href: "/cart", label: "Cart" },
  { href: "/orders", label: "Orders" },
];

export default function Footer() {
  return (
    <footer className="mt-16 bg-brand text-cream">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6">
        <div>
          <p className="text-2xl font-extrabold tracking-tight">
            Naija<span className="text-gold">Bites</span>
          </p>
          <p className="mt-1 text-sm font-medium text-gold">
            Fresh. Homemade. Delivered.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/70">
            Authentic homemade Nigerian snacks and small chops, prepared fresh
            and delivered across Lagos.
          </p>
        </div>

        <div className="sm:justify-self-end">
          <p className="text-sm font-semibold uppercase tracking-wider text-gold">
            Explore
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-cream/80">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="transition-colors hover:text-gold"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs text-cream/60">
        © {new Date().getFullYear()} NaijaBites. All rights reserved.
      </div>
    </footer>
  );
}
