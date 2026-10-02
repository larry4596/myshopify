/**
 * Product catalog for NaijaBites.
 *
 * Phase 1: products live here as typed data so the shop UI can be built
 * without a database. In Phase 3 the exact same `Product` shape will be
 * loaded from Supabase, so pages only need their data source swapped.
 *
 * Prices are stored in Kobo (integers) to avoid floating-point rounding
 * bugs:  ₦2,500  ->  250_000
 */

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceKobo: number;
  imageUrl: string;
};

export const products: Product[] = [
  {
    id: "puff-puff",
    slug: "classic-puff-puff",
    name: "Classic Puff-Puff",
    description: "Soft, golden, slightly sweet dough balls. Pack of 12.",
    priceKobo: 250_000,
    imageUrl: "/products/puff-puff.svg",
  },
  {
    id: "chin-chin",
    slug: "crunchy-chin-chin",
    name: "Crunchy Chin-Chin",
    description: "Crispy, lightly spiced chin-chin. 500g pack.",
    priceKobo: 180_000,
    imageUrl: "/products/chin-chin.svg",
  },
  {
    id: "meat-pies",
    slug: "mini-meat-pies",
    name: "Mini Meat Pies",
    description: "Flaky pastry filled with spiced minced meat. Pack of 6.",
    priceKobo: 350_000,
    imageUrl: "/products/meat-pies.svg",
  },
  {
    id: "spring-rolls",
    slug: "spring-rolls",
    name: "Spring Rolls (6pcs)",
    description: "Crispy vegetable spring rolls.",
    priceKobo: 280_000,
    imageUrl: "/products/spring-rolls.svg",
  },
  {
    id: "suya-wings",
    slug: "suya-chicken-wings",
    name: "Suya Chicken Wings",
    description: "Spicy grilled chicken wings with suya spice. Pack of 8.",
    priceKobo: 450_000,
    imageUrl: "/products/suya-wings.svg",
  },
  {
    id: "small-chops-box",
    slug: "mixed-small-chops-box",
    name: "Mixed Small Chops Box",
    description:
      "Assorted: 6 puff-puff, 4 meat pies, 4 spring rolls, chin-chin.",
    priceKobo: 750_000,
    imageUrl: "/products/small-chops-box.svg",
  },
];

/** Find a product by its URL slug (used by /products/[slug]). */
export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

/** Format kobo as Nigerian Naira, e.g. 250_000 -> "₦2,500". */
const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatNaira(priceKobo: number): string {
  return nairaFormatter.format(priceKobo / 100);
}
