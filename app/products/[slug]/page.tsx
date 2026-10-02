import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatNaira,
  getProductBySlug,
  products,
} from "@/lib/products";
import AddToCartPanel from "@/components/AddToCartPanel";
type ProductPageProps = {
  /** Next.js 15: route params are async and must be awaited. */
  params: Promise<{ slug: string }>;
};

/** Pre-render every product page at build time (they come from static data). */
export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return { title: "Product not found" };
  }
  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  // Unknown slug -> renders app/not-found.tsx
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link
        href="/#menu"
        className="text-sm font-medium text-brand hover:underline"
      >
        ← Back to menu
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        {/* Product image */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        </div>

        {/* Details */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
            {product.name}
          </h1>

          <p className="mt-4 inline-block rounded-full bg-gold px-4 py-1.5 text-lg font-extrabold text-ink">
            {formatNaira(product.priceKobo)}
          </p>

          <p className="mt-4 leading-relaxed text-ink/70">
            {product.description}
          </p>

          {/* Quantity + add to cart (Phase 4: wired to the localStorage cart) */}
          <AddToCartPanel
            slug={product.slug}
            buttonClassName="mt-6 w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-dark sm:w-auto"
          />

          <ul className="mt-8 space-y-3 border-t border-black/5 pt-6 text-sm text-ink/60">
            <li>✅ Prepared fresh on the day of delivery</li>
            <li>🛵 Same-day delivery across Lagos (selected areas)</li>
            <li>📦 Carefully packed so it stays fresh on the way</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
