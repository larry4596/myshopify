import { formatNaira } from "@/lib/products";
import type { OrderListItem } from "@/lib/orders";

/** Badge colours per status (PRD §8: pending | paid | failed). */
const statusStyles: Record<OrderListItem["status"], string> = {
  paid: "bg-brand-light text-brand",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-700",
};

/** Lagos time — the store only delivers there (PRD §1). */
const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

/**
 * One order in the history list (FR3.4): order number, date, status,
 * itemised lines and total. Server component — data comes from Supabase
 * in the page, nothing here touches the browser.
 */
export default function OrderCard({ order }: { order: OrderListItem }) {
  return (
    <article className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-bold tracking-tight text-brand">
          {order.orderNumber}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusStyles[order.status]}`}
        >
          {order.status}
        </span>
      </div>

      <p className="mt-1 text-xs text-ink/50">
        {dateFormatter.format(new Date(order.createdAt))}
        {order.paidAt ? " · Paid" : ""}
      </p>

      <ul className="mt-4 space-y-2 border-t border-black/5 pt-3 text-sm">
        {order.items.map((item, index) => (
          <li
            key={`${order.id}-${index}`}
            className="flex items-baseline justify-between gap-4"
          >
            <span className="text-ink/70">
              {item.productName}{" "}
              <span className="text-ink/40">× {item.quantity}</span>
            </span>
            <span className="shrink-0 font-medium">
              {formatNaira(item.unitPriceKobo * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3">
        <span className="text-sm font-semibold text-ink/70">Total</span>
        <span className="text-lg font-extrabold text-brand">
          {formatNaira(order.totalKobo)}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink/50">
        Deliver to: {order.customerName} · {order.customerPhone} —{" "}
        {order.address}
        {order.notes ? ` (${order.notes})` : ""}
      </p>
    </article>
  );
}
