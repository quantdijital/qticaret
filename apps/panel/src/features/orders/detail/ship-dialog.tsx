import { Loader2, Truck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { NumberField } from "@/components/patterns/number-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { OrderDetail } from "@/features/orders/api/orders"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { formatCount } from "@/lib/format"

interface ShipDialogProps {
  order: OrderDetail
  items: { id: string; quantity: number }[]
  /** A parcel already packed goes whole: its lines cannot be changed. */
  packed: boolean
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  /** `items` only when a part of what is left goes (F7.10); `tracking` for the shop's own parcel. */
  onConfirm: (
    notify: boolean,
    items?: { id: string; quantity: number }[],
    tracking?: ShipTracking
  ) => void
}

/** The shop's own parcel's tracking (F18): a carrier integration has its own and ignores it. */
export interface ShipTracking {
  carrier: string
  number: string
  url: string | null
}

const TRACKING_NUMBER = /^[A-Za-z0-9-]{4,40}$/

/** The typed tracking, or why it cannot go; nothing typed is no tracking. */
function trackingOf(
  carrier: string,
  number: string,
  url: string
): { tracking: ShipTracking | undefined; problem: string | null } {
  const [name, no, link] = [carrier.trim(), number.trim(), url.trim()]
  if (!name && !no && !link) {
    return { tracking: undefined, problem: null }
  }
  if (!name || name.length > 60 || !TRACKING_NUMBER.test(no)) {
    return { tracking: undefined, problem: "orders.ship.trackingInvalid" }
  }
  if (link && (!link.startsWith("https://") || link.length > 500 || !URL.canParse(link))) {
    return { tracking: undefined, problem: "orders.ship.trackingUrlInvalid" }
  }
  return { tracking: { carrier: name, number: no, url: link || null }, problem: null }
}

/**
 * "Kargoya ver": what goes in the parcel (all that is left, or fewer of
 * each line for an order in several parcels), and whether the customer
 * hears of it. With a carrier the parcel's label is bought (adr/0031).
 */
export function ShipDialog({
  order,
  items,
  packed,
  open,
  busy,
  onOpenChange,
  onConfirm,
}: ShipDialogProps) {
  const { t } = useTranslation()
  const [notify, setNotify] = useState(true)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [carrier, setCarrier] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")
  const { tracking, problem } = trackingOf(carrier, trackingNumber, trackingUrl)
  const byId = new Map(order.items.map((item) => [item.id, item]))
  const countOf = (id: string, left: number) => Math.min(Math.max(counts[id] ?? left, 0), left)
  const chosen = items
    .map(({ id, quantity }) => ({ id, quantity: countOf(id, quantity) }))
    .filter((item) => item.quantity > 0)
  const whole =
    chosen.length === items.length &&
    chosen.every((item, index) => item.quantity === items[index]?.quantity)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("orders.ship.title", { number: order.display_id })}</DialogTitle>
          <DialogDescription>{t("orders.ship.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody list>
          <ul className="relative flex max-h-72 flex-col divide-y overflow-y-auto rounded-md border">
            {items.map(({ id, quantity }) => {
              const item = byId.get(id)
              return (
                <li key={id} className="flex min-h-12 items-center gap-3 px-3 py-1.5">
                  <ProductThumb src={item?.thumbnail} className="size-9" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{item?.title}</span>
                    {item?.subtitle ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    ) : null}
                  </span>
                  {packed ? (
                    <span className="text-sm tabular-nums">× {formatCount(quantity)}</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                      <NumberField
                        plain
                        size="compact"
                        min={0}
                        max={quantity}
                        aria-label={t("orders.ship.quantityOf", { name: item?.title ?? "" })}
                        className="w-24"
                        value={countOf(id, quantity)}
                        onChange={(event) => {
                          setCounts({ ...counts, [id]: Number(event.target.value) || 0 })
                        }}
                      />
                      <span className="tabular-nums">/ {formatCount(quantity)}</span>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <details className="rounded-md border px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium">
              {t("orders.ship.trackingTitle")}
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">{t("orders.ship.trackingHint")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Input
                aria-label={t("orders.ship.carrier")}
                placeholder={t("orders.ship.carrier")}
                maxLength={60}
                value={carrier}
                onChange={(event) => {
                  setCarrier(event.target.value)
                }}
              />
              <Input
                aria-label={t("orders.ship.trackingNumber")}
                placeholder={t("orders.ship.trackingNumber")}
                maxLength={40}
                value={trackingNumber}
                onChange={(event) => {
                  setTrackingNumber(event.target.value)
                }}
              />
              <Input
                type="url"
                aria-label={t("orders.ship.trackingUrl")}
                placeholder={t("orders.ship.trackingUrl")}
                maxLength={500}
                className="sm:col-span-2"
                value={trackingUrl}
                onChange={(event) => {
                  setTrackingUrl(event.target.value)
                }}
              />
            </div>
            {problem ? <p className="mt-2 text-xs text-destructive">{t(problem)}</p> : null}
          </details>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox
              checked={notify}
              onCheckedChange={(checked) => {
                setNotify(checked === true)
              }}
            />
            {t("orders.ship.notify")}
          </label>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              onOpenChange(false)
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            disabled={busy || chosen.length === 0 || problem !== null}
            onClick={() => {
              onConfirm(notify, whole ? undefined : chosen, tracking)
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Truck />}
            {t("orders.actions.ship")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
