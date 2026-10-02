import Image from "next/image";
import Link from "next/link";
import { formatNaira, type Product } from "@/lib/products";

/**
 * Product card used in the home page menu grid.
 * "Add to cart" becomes functional in Phase 4 (CartContext).
 */
export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 transition-shadow hover:shadow-lg">
      {/* Image -> links to the detail page */}
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/3] overflow-hidden bg-brand-light"
      >
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold leading-snug text-brand">
            <Link
              href={`/products/${product.slug}`}
              className="hover:underline"
            >
              {product.name}
            </Link>
          </h3>
          <span className="shrink-0 rounded-full bg-brand-light px-2.5 py-1 text-sm font-extrabold text-brand">
            {formatNaira(product.priceKobo)}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-ink/60">
          {product.description}
        </p>

        <div className="mt-4 flex items-center gap-2 pt-2">
          {/* Phase 4: wired to CartContext (localStorage) */}
          <button
            type="button"
            className="flex-1 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Add to cart
          </button>
          <Link
            href={`/products/${product.slug}`}
            className="rounded-full border border-brand/30 px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-light"
          >
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}
