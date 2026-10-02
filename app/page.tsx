import Link from "next/link";
import { products } from "@/lib/products";
import ProductCard from "@/components/ProductCard";

/**
 * Home page: brand hero + the product menu grid.
 * All products come from lib/products.ts (swapped to Supabase in Phase 3).
 */
export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <div className="rounded-3xl bg-brand px-6 py-12 text-center sm:px-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-gold">
            Fresh. Homemade. Delivered.
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Authentic Nigerian snacks, made at home
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-cream/80 sm:text-base">
            Puff-puff, chin-chin, meat pies, small chops and more — prepared
            fresh every day and delivered across Lagos.
          </p>
          <div className="mt-8">
            <a
              href="#menu"
              className="inline-block rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink transition-colors hover:bg-gold-dark"
            >
              Browse our menu
            </a>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="mx-auto mt-8 grid max-w-6xl gap-4 px-4 sm:grid-cols-3 sm:px-6">
        <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-black/5">
          <p className="text-2xl" aria-hidden>
            🌱
          </p>
          <p className="mt-2 font-semibold text-brand">Made fresh daily</p>
          <p className="mt-1 text-sm text-ink/60">
            Nothing frozen, nothing stored.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-black/5">
          <p className="text-2xl" aria-hidden>
            🛵
          </p>
          <p className="mt-2 font-semibold text-brand">Fast Lagos delivery</p>
          <p className="mt-1 text-sm text-ink/60">
            Hot & fresh to your doorstep.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-black/5">
          <p className="text-2xl" aria-hidden>
            🍲
          </p>
          <p className="mt-2 font-semibold text-brand">100% homemade</p>
          <p className="mt-1 text-sm text-ink/60">
            Real recipes, real ingredients.
          </p>
        </div>
      </section>

      {/* Menu */}
      <section id="menu" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
          Our Menu
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          Six favourites, packed with home-style flavour.
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
        <div className="rounded-2xl bg-white p-6 ring-1 ring-black/5 sm:p-8">
          <h2 className="text-xl font-extrabold text-brand">How it works</h2>
          <ol className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <li className="rounded-xl bg-cream p-4">
              <span className="font-bold text-gold-dark">1.</span>{" "}
              <span className="font-semibold">Pick your snacks</span>
              <p className="mt-1 text-ink/60">
                Add anything from the menu to your cart.
              </p>
            </li>
            <li className="rounded-xl bg-cream p-4">
              <span className="font-bold text-gold-dark">2.</span>{" "}
              <span className="font-semibold">Check out securely</span>
              <p className="mt-1 text-ink/60">
                Sign in with Google and pay with Paystack.
              </p>
            </li>
            <li className="rounded-xl bg-cream p-4">
              <span className="font-bold text-gold-dark">3.</span>{" "}
              <span className="font-semibold">Get it delivered</span>
              <p className="mt-1 text-ink/60">
                Fresh to your door — confirmation in your inbox.
              </p>
            </li>
          </ol>
          <p className="mt-6 text-sm text-ink/60">
            Questions?{" "}
            <Link
              href="/orders"
              className="font-medium text-brand hover:underline"
            >
              Track your orders here
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
