import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { formatCount, formatDate, formatDateTime, formatMoney } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { BOOKING_FLAG, slotsQuery } from "@/features/products/api/booking"
import type { BookingSlot } from "@/features/products/api/booking"
import { interestQuery } from "@/features/products/api/interest"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import { PublishScheduleRow } from "@/features/products/detail/publish-schedule-row"
import type { ProductDetail } from "@/features/products/api/products"
import { availableStock, priceRange } from "@/features/products/product-math"
import { useFeature } from "@/features/settings/api/features"

const I = "products.interest"
const P = "products.detail"

const LIST = "grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5"

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right tabular-nums", strong && "text-sm font-semibold")}>{value}</dd>
    </div>
  )
}

/** The departures still ahead and open: the first, and the places left on them all. */
function departuresAhead(
  slots: readonly BookingSlot[],
  now: Date = new Date()
): { next: BookingSlot | null; places: number; count: number } {
  const open = slots
    .filter((slot) => slot.status === "open" && new Date(slot.starts_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return {
    next: open[0] ?? null,
    places: open.reduce((sum, slot) => sum + Math.max(0, slot.available), 0),
    count: open.length,
  }
}

/** A dated product's places (adr/0076): its next departure and what is left, instead of stock. */
function DepartureRows({ productId }: { productId: string }) {
  const { t } = useTranslation()
  const slots = useQuery(slotsQuery(productId)).data
  if (!slots) {
    return (
      <>
        <Row label={t(`${P}.nextDeparture`)} value="—" />
        <Row label={t(`${P}.placesLeft`)} value="—" />
      </>
    )
  }
  const ahead = departuresAhead(slots)
  return (
    <>
      <Row
        label={t(`${P}.nextDeparture`)}
        value={ahead.next ? formatDateTime(ahead.next.starts_at) : t(`${P}.noDeparture`)}
      />
      {ahead.count > 0 ? (
        <Row
          label={t(`${P}.placesLeft`)}
          value={t(`${P}.placesLeftValue`, {
            places: formatCount(ahead.places),
            departures: formatCount(ahead.count),
          })}
        />
      ) : null}
    </>
  )
}

/**
 * The product at a glance, in the page's narrow column (docs/06 "Ürün
 * sayfası"): its price span and sellable stock, how many keep it and
 * wait for it (F10.4–F10.5, counts only, so the shop knows what to
 * restock first), when it was added and last changed (one line), and a
 * draft's planned publish (S2, `PublishScheduleRow`). A product sold by
 * departure has no shelf: its next departure and the places left stand
 * in for the stock and its waiting list. The pictures and the prices
 * themselves are in the main column.
 */
export function SummaryCard({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const interest = useQuery(interestQuery(product.id)).data
  const catalog = useQuery(productCatalogQuery(product.id)).data
  const booking = useFeature(BOOKING_FLAG)
  const dated = booking && catalog?.booking_mode === "departure"
  const range = priceRange(product.variants, "try")
  const stock = availableStock(product.variants)
  const price = range
    ? range.min === range.max
      ? formatMoney(range.min, "try")
      : `${formatMoney(range.min, "try")} – ${formatMoney(range.max, "try")}`
    : "—"
  const waiting = interest?.stock_alerts ?? []
  const date = (value: ProductDetail["created_at"], at: (value: string) => string) =>
    value ? at(value) : "—"
  return (
    <SectionCard title={t(`${P}.summary`)}>
      <div className="flex flex-col gap-2.5 text-[13px]">
        <dl className={LIST}>
          <Row label={t("products.columns.price")} value={price} strong />
          {dated ? (
            <DepartureRows productId={product.id} />
          ) : (
            <Row
              label={t(`${P}.available`)}
              value={stock === null ? t("products.untracked") : formatCount(stock)}
            />
          )}
          <Row
            label={t("products.columns.variants")}
            value={formatCount(product.variants?.length ?? 0)}
          />
          <Row label={t(`${I}.wishlist`)} value={interest ? formatCount(interest.wishlist) : "—"} />
          {dated ? null : waiting.length === 0 ? (
            <Row label={t(`${I}.waiting`)} value={interest ? formatCount(0) : "—"} />
          ) : (
            waiting.map((variant) => (
              <Row
                key={variant.variant_id}
                label={t(`${I}.waitingFor`, { variant: variant.title ?? "" })}
                value={formatCount(variant.waiting)}
              />
            ))
          )}
        </dl>
        <p className="border-t pt-2.5 text-xs text-muted-foreground tabular-nums">
          {t(`${P}.datesLine`, {
            created: date(product.created_at, formatDate),
            updated: date(product.updated_at, formatDateTime),
          })}
        </p>
        <PublishScheduleRow product={product} />
      </div>
    </SectionCard>
  )
}
