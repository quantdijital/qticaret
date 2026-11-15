import { ResponsiveImage } from "@qticaret/ui"
import type { PaymentLinkOrderView, PaymentLinkLineView, Translate } from "@qticaret/ui"

/**
 * The order's lines, each a white row in the summary's well: the
 * photograph rounded, name, variant, "2 × 150,00 TL", the line's total
 * heavy; one out of stock says so in red.
 */
export function LinkLines({ lines, t }: { lines: PaymentLinkLineView[]; t: Translate }) {
  return (
    <ul className="flex flex-col gap-2">
      {lines.map((line, index) => (
        <li
          key={`${line.title}-${String(index)}`}
          className="flex items-start gap-4 rounded-media gf-pane-inner p-3"
        >
          <div className="size-16 shrink-0 overflow-hidden rounded-inner bg-media-deep sm:size-20">
            {line.image ? (
              <ResponsiveImage
                image={{ ...line.image, alt: "" }}
                sizes="80px"
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-full items-center justify-center text-2xl font-extrabold text-text-3"
              >
                {line.title.charAt(0).toLocaleUpperCase("tr")}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
            <p className="text-md leading-snug font-semibold">{line.title}</p>
            {line.detail && <p className="text-text-2">{line.detail}</p>}
            <p className="tabular text-text-2">
              {t("payment_link.line_quantity", { quantity: line.quantity, price: line.unitPrice })}
            </p>
            {!line.inStock && (
              <p className="font-semibold text-error">{t("payment_link.line_out_of_stock")}</p>
            )}
          </div>
          <p className="tabular shrink-0 text-md font-extrabold">{line.total}</p>
        </li>
      ))}
    </ul>
  )
}

/** Items, discount, shipping in words, then the total large. */
export function LinkTotals({ order, t }: { order: PaymentLinkOrderView; t: Translate }) {
  return (
    <dl className="tabular flex flex-col gap-3 text-md">
      <div className="flex justify-between gap-4">
        <dt className="text-text-2">{t("cart.items")}</dt>
        <dd className="font-semibold">{order.items}</dd>
      </div>
      {order.discount && (
        <div className="flex justify-between gap-4 text-deal">
          <dt>{t("cart.discount")}</dt>
          <dd className="font-semibold">−{order.discount}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt className="text-text-2">{t("cart.shipping")}</dt>
        <dd className="text-right text-text-2">
          {order.shippingPreset
            ? t("payment_link.shipping_preset")
            : t("payment_link.shipping_at_checkout")}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 rounded-media gf-pane-inner px-4 py-3">
        <dt className="font-semibold">{t("cart.total")}</dt>
        <dd className="text-price font-extrabold tracking-[-0.01em]">{order.total}</dd>
      </div>
    </dl>
  )
}
