import Link from "next/link";

/** Custom 404 page (also used for unknown product slugs via notFound()). */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="text-6xl" aria-hidden>
        🥡
      </p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-brand">
        Page not found
      </h1>
      <p className="mt-2 text-ink/60">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-dark"
      >
        Back to home
      </Link>
    </div>
  );
}
