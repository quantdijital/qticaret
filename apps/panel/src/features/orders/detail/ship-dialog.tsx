import { Loader2, Truck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import type { OrderDetail } from "@/features/orders/api/orders"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { formatCount } from "@qticaret/admin-ui/lib/format"

type Lines = { id: string; quantity: number }[]

/**
 * What goes: the packed parcel (handed over whole), and lines for a new
 * parcel (`items`; none: all that is left, when nothing is packed).
 */
export interface ShipParcels {
  packed: boolean
  items?: Lines | undefined
}

interface ShipDialogProps {
  order: OrderDetail
  /** The packed parcel's lines, or what is left to pack. */
  items: Lines
  /** Beside a packed parcel, the lines no parcel holds yet: they may go too (adr/0054 addendum). */
  rest?: Lines | undefined
  /** A parcel already packed goes whole: its lines cannot be changed. */
  packed: boolean
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  /** `tracking` for the shop's own parcel. */
  onConfirm: (notify: boolean, parcels: ShipParcels, tracking?: ShipTracking) => void
}

/** The shop's own parcel's tracking (F18): a carrier integration has its own and ignores it. */
export interface ShipTracking {
  carrier: string
  number: string
  url: string | null
}

const TRACKING_NUMBER = /^[A-Za-z0-9-]{4,40}$/

/**
 * A link as staff paste it, made one the customer can open safely: no
 * scheme or `http://` becomes `https://` (every Turkish carrier's page has it).
 */
function linkOf(text: string): string {
  if (/^https:\/\//i.test(text) || text === "") {
    return text
  }
  return `https://${text.replace(/^http:\/\//i, "")}`
}

/** A web address with a host name that has a dot (`kargo.example.com`). */
const isWebLink = (link: string): boolean =>
  URL.canParse(link) && new URL(link).hostname.includes(".")

/** The typed tracking, or why it cannot go; nothing typed is no tracking. */
function trackingOf(
  carrier: string,
  number: string,
  url: string
): { tracking: ShipTracking | undefined; problem: string | null } {
  // A number copied with spaces ("1234 5678 90") is the same number
  const [name, no, link] = [carrier.trim(), number.replace(/\s+/g, ""), linkOf(url.trim())]
  if (!name && !no && !link) {
    return { tracking: undefined, problem: null }
  }
  if (!name || name.length > 60 || !TRACKING_NUMBER.test(no)) {
    return { tracking: undefined, problem: "orders.ship.trackingInvalid" }
  }
  if (link && (link.length > 500 || !isWebLink(link))) {
    return { tracking: undefined, problem: "orders.ship.trackingUrlInvalid" }
  }
  return { tracking: { carrier: name, number: no, url: link || null }, problem: null }
}

/**
 * "Kargoya ver": what goes in the parcel (all that is left, or fewer of
 * each line for an order in several parcels), and whether the customer
 * hears of it. A packed parcel goes whole, and the lines beside it in a
 * parcel of their own, together or one after the other. With a carrier
 * the parcel's label is bought (adr/0031).
 */
export function ShipDialog({
  order,
  items,
  rest = [],
  packed,
  open,
  busy,
  onOpenChange,
  onConfirm,
}: ShipDialogProps) {
  const { t } = useTranslation()
  const [notify, setNotify] = useState(true)
  const [withPacked, setWithPacked] = useState(true)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [carrier, setCarrier] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")
  const { tracking, problem } = trackingOf(carrier, trackingNumber, trackingUrl)
  const byId = new Map(order.items.map((item) => [item.id, item]))
  const countOf = (id: string, left: number) => Math.min(Math.max(counts[id] ?? left, 0), left)
  // The lines a new parcel may take: what is left, or what lies beside the packed parcel
  const openLines = packed ? rest : items
  const chosen = openLines
    .map(({ id, quantity }) => ({ id, quantity: countOf(id, quantity) }))
    .filter((item) => item.quantity > 0)
  const whole =
    chosen.length === openLines.length &&
    chosen.every((item, index) => item.quantity === openLines[index]?.quantity)
  const parcels: ShipParcels = packed
    ? { packed: withPacked || rest.length === 0, ...(chosen.length > 0 ? { items: chosen } : {}) }
    : { packed: false, ...(whole ? {} : { items: chosen }) }
  const nothing = packed ? !parcels.packed && chosen.length === 0 : chosen.length === 0

  const line = (id: string, quantity: number, editable: boolean) => {
    const item = byId.get(id)
    return (
      <li key={id} className="flex min-h-12 items-center gap-3 px-3 py-1.5">
        <ProductThumb src={item?.thumbnail} className="size-9" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{item?.title}</span>
          {item?.subtitle ? (
            <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>
          ) : null}
        </span>
        {editable ? (
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
        ) : (
          <span className="text-sm tabular-nums">× {formatCount(quantity)}</span>
        )}
      </li>
    )
  }
  const list = "relative flex flex-col divide-y rounded-md border"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent pane>
        <DialogHeader>
          <DialogTitle>{t("orders.ship.title", { number: order.display_id })}</DialogTitle>
          <DialogDescription>{t("orders.ship.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody list>
          {packed && rest.length > 0 ? (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
              <Checkbox
                checked={withPacked}
                onCheckedChange={(checked) => {
                  setWithPacked(checked === true)
                }}
              />
              {t("orders.ship.packedParcel")}
            </label>
          ) : null}
          <ul className={list}>{items.map(({ id, quantity }) => line(id, quantity, !packed))}</ul>
          {packed && rest.length > 0 ? (
            <>
              <p className="text-sm font-medium">{t("orders.ship.restTitle")}</p>
              <ul className={list}>{rest.map(({ id, quantity }) => line(id, quantity, true))}</ul>
            </>
          ) : null}
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
                maxLength={60}
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
            variant="cancel"
            disabled={busy}
            onClick={() => {
              onOpenChange(false)
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            disabled={busy || nothing || problem !== null}
            onClick={() => {
              onConfirm(notify, parcels, tracking)
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
