import { ResponsiveImage } from "@qticaret/ui"
import type { PaymentLinkLineView, Translate } from "@qticaret/ui"

/** The order's lines: picture, name, variant, "2 × 150,00 TL", the line's total; one out of stock says so. */
export function LinkLines({ lines, t }: { lines: PaymentLinkLineView[]; t: Translate }) {
  return (
    <ul className="divide-y">
      {lines.map((line, index) => (
        <li key={`${line.title}-${String(index)}`} className="flex gap-4 py-4 first:pt-0">
          <div className="size-16 shrink-0 overflow-hidden rounded-xl border bg-muted/50 sm:size-20">
            {line.image ? (
              <ResponsiveImage
                image={line.image}
                sizes="80px"
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="font-heading flex h-full items-center justify-center text-2xl text-foreground/15"
              >
                {line.title.charAt(0).toLocaleUpperCase("tr")}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <p className="leading-snug font-medium">{line.title}</p>
            {line.detail && <p className="text-muted-foreground">{line.detail}</p>}
            <p className="tabular text-muted-foreground">
              {t("payment_link.line_quantity", { quantity: line.quantity, price: line.unitPrice })}
            </p>
            {!line.inStock && (
              <p className="font-medium text-sale">{t("payment_link.line_out_of_stock")}</p>
            )}
          </div>
          <p className="tabular shrink-0 text-sm font-semibold">{line.total}</p>
        </li>
      ))}
    </ul>
  )
}
