import { formatNaira } from "@/lib/products";

/**
 * Order confirmation email content (PRD FR5.3) — a responsive, table-based
 * HTML body in the NaijaBites brand (green/gold/cream) plus a plain-text twin
 * for clients that don't render HTML.
 *
 * Pure string building with no I/O, so it is safe to import from any server
 * route. Every dynamic value is HTML-escaped — the customer name, address and
 * notes all come from a form the buyer filled in.
 */

export type OrderEmailData = {
  /** Human order number, e.g. NB-20260210-A1B2. */
  orderNumber: string;
  /** ISO timestamp the order was placed. */
  createdAt: string;
  customerName: string;
  customerPhone: string;
  address: string;
  notes: string | null;
  items: { productName: string; unitPriceKobo: number; quantity: number }[];
  totalKobo: number;
  /** Absolute URL of the receipt (site origin + /checkout/success?...). */
  receiptUrl: string;
};

/* Brand tokens — must match app/globals.css / PRD §7. */
const GREEN = "#0F6B3C";
const GOLD = "#E8B923";
const CREAM = "#F9F5EB";
const INK = "#1A1A1A";
const MUTED = "#6B7280";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

/** Escape a string for safe interpolation into HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function orderConfirmationSubject(orderNumber: string): string {
  return `Order confirmed — ${orderNumber} · NaijaBites`;
}

export function renderOrderConfirmationText(order: OrderEmailData): string {
  const lines = [
    "NaijaBites — Order confirmed",
    "Fresh. Homemade. Delivered.",
    "",
    `Hi ${order.customerName || "there"},`,
    "",
    "Thank you for your order! Payment received — we're preparing your snacks fresh.",
    "",
    `Order number: ${order.orderNumber}`,
    `Placed: ${dateFormatter.format(new Date(order.createdAt))}`,
    "",
    "Items:",
    ...order.items.map(
      (item) =>
        `  - ${item.productName} x ${item.quantity} — ${formatNaira(item.unitPriceKobo * item.quantity)}`,
    ),
    "",
    `Total paid: ${formatNaira(order.totalKobo)}`,
    "",
    "Delivering to:",
    `  ${order.customerName}`,
    `  ${order.customerPhone}`,
    `  ${order.address}`,
    ...(order.notes ? [`  Notes: ${order.notes}`] : []),
    "",
    "View your receipt:",
    order.receiptUrl,
    "",
    "Thank you for ordering with NaijaBites!",
    "Fresh. Homemade. Delivered.",
  ];
  return lines.join("\n");
}

export function renderOrderConfirmationHtml(order: OrderEmailData): string {
  const placed = escapeHtml(dateFormatter.format(new Date(order.createdAt)));
  const orderNumber = escapeHtml(order.orderNumber);

  const itemRows = order.items
    .map((item) => {
      const name = escapeHtml(item.productName);
      const lineTotal = formatNaira(item.unitPriceKobo * item.quantity);
      return `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #EDE7D6;font-size:15px;color:${INK};">
                ${name} <span style="color:${MUTED};">&times; ${item.quantity}</span>
              </td>
              <td align="right" style="padding:10px 12px;border-bottom:1px solid #EDE7D6;font-size:15px;color:${INK};white-space:nowrap;">
                ${lineTotal}
              </td>
            </tr>`;
    })
    .join("");

  const notesRow = order.notes
    ? `<tr>
            <td style="padding:4px 0;font-size:13px;color:${MUTED};">Notes</td>
            <td style="padding:4px 0;font-size:13px;color:${INK};text-align:right;">${escapeHtml(order.notes)}</td>
          </tr>`
    : "";

  const receiptHref = escapeHtml(order.receiptUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${orderConfirmationSubject(order.orderNumber)}</title>
</head>
<body style="margin:0;padding:0;background-color:${CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${CREAM};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Logo header -->
          <tr>
            <td style="background-color:${GREEN};padding:24px 32px;text-align:center;">
              <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#FFFFFF;">
                Naija<span style="color:${GOLD};">Bites</span>
              </div>
              <div style="margin-top:4px;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:${GOLD};">
                Fresh. Homemade. Delivered.
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${GREEN};">
                Payment confirmed — thank you!
              </h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${INK};">
                Hi${order.customerName ? ` ${escapeHtml(order.customerName)}` : ""}, we've received your payment and your snacks are being prepared fresh.
              </p>



              <!-- Order number -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${CREAM};border-radius:12px;margin-bottom:20px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};">Order number</div>
                    <div style="font-size:18px;font-weight:800;color:${GREEN};font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;">
                      ${orderNumber}
                    </div>
                    <div style="font-size:12px;color:${MUTED};margin-top:2px;">Placed ${placed}</div>
                  </td>
                </tr>
              </table>
              <!-- Items -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #EDE7D6;border-radius:12px;overflow:hidden;">
                <tr style="background-color:${GREEN};">
                  <th align="left" style="padding:10px 12px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#FFFFFF;">Item</th>
                  <th align="right" style="padding:10px 12px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#FFFFFF;">Price</th>
                </tr>
                ${itemRows}
                <tr>
                  <td style="padding:12px;font-size:15px;font-weight:700;background-color:${CREAM};">Total paid</td>
                  <td align="right" style="padding:12px;font-size:17px;font-weight:800;color:${GREEN};background-color:${CREAM};white-space:nowrap;">
                    ${formatNaira(order.totalKobo)}
                  </td>
                </tr>
              </table>
              <!-- Delivery details -->
              <div style="margin:24px 0 4px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${MUTED};">
                Delivery details
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${INK};">
                <tr>
                  <td style="padding:4px 0;">${escapeHtml(order.customerName)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:${MUTED};">${escapeHtml(order.customerPhone)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;">${escapeHtml(order.address)}</td>
                </tr>
                ${notesRow}
              </table>
              <!-- Receipt button -->
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 0;">
                <tr>
                  <td style="border-radius:999px;background-color:${GREEN};">
                    <a href="${receiptHref}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">
                      View your receipt
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Thank-you note -->
              <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:${INK};text-align:center;">
                Thank you for ordering with NaijaBites!<br />
                <span style="color:${GREEN};font-weight:700;">Fresh. Homemade. Delivered.</span>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:${CREAM};padding:16px 32px;text-align:center;font-size:12px;color:${MUTED};">
              This is a confirmation for your NaijaBites order <strong style="color:${GREEN};">${orderNumber}</strong>.
              Delivery across Lagos.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

