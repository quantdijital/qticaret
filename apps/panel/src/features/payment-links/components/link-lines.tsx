import { ImageOff } from "lucide-react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { LinkDiscount, LinkLine } from "@/features/payment-links/api/types"
import { formatKurus } from "@/features/payment-links/format"
import { formatCount } from "@/lib/format"

const P = "paymentLinks.lines"

/** A link's lines as the backend priced them; those short on the shelf say so. */
export function LinkLines({
  lines,
  currency,
  short = new Set(),
}: {
  lines: readonly LinkLine[]
  currency: string
  short?: ReadonlySet<string>
}) {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-col divide-y">
      {lines.map((line) => (
        <li key={line.variant_id} className="flex items-center gap-3 py-2.5">
          {line.thumbnail ? (
            <img
              src={line.thumbnail}
              alt=""
              className="size-10 shrink-0 rounded-md border object-cover"
            />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
              <ImageOff className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{line.title}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {line.variant_title ? <span>{line.variant_title}</span> : null}
              <span className="tabular-nums">
                {t(`${P}.each`, {
                  quantity: formatCount(line.quantity),
                  price: formatKurus(line.unit_price, currency),
                })}
              </span>
              {short.has(line.variant_id) ? (
                <StatusBadge tone="warning">{t(`${P}.short`)}</StatusBadge>
              ) : null}
            </span>
          </div>
          <span className="shrink-0 text-sm tabular-nums">{formatKurus(line.total, currency)}</span>
        </li>
      ))}
    </ul>
  )
}

function Row({
  label,
  note,
  value,
  strong,
}: {
  label: string
  /** Under the label, smaller: why a discount was given. */
  note?: string
  value: string
  strong?: boolean
}) {
  return (
    <div
      className={
        strong
          ? "flex items-baseline justify-between gap-3 border-t pt-2 text-[15px] font-semibold"
          : "flex items-baseline justify-between gap-3 text-sm"
      }
    >
      <dt className={strong ? undefined : "flex min-w-0 flex-col text-muted-foreground"}>
        {label}
        {note ? <span className="text-xs break-words">{note}</span> : null}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

/** The lines' sum, the discount and the total: the backend's numbers, as given. */
export function LinkTotals({
  itemsTotal,
  discount,
  discountTotal,
  total,
  currency,
}: {
  itemsTotal: number
  discount: LinkDiscount | null
  /** The list rows' own sum of it; the discount's `amount` otherwise. */
  discountTotal?: number
  total: number
  currency: string
}) {
  const { t } = useTranslation()
  const off = discountTotal ?? discount?.amount ?? 0
  return (
    <div className="flex flex-col gap-2">
      <dl className="flex flex-col gap-1.5">
        <Row label={t(`${P}.itemsTotal`)} value={formatKurus(itemsTotal, currency)} />
        {discount && off > 0 ? (
          <Row
            label={
              discount.type === "percentage"
                ? t(`${P}.discountPercent`, { percent: discount.value })
                : t(`${P}.discount`)
            }
            note={t(`${P}.reason`, { reason: discount.reason })}
            value={`−${formatKurus(off, currency)}`}
          />
        ) : null}
        <Row label={t(`${P}.total`)} value={formatKurus(total, currency)} strong />
      </dl>
      <p className="text-xs text-muted-foreground">{t(`${P}.shippingLater`)}</p>
    </div>
  )
}
