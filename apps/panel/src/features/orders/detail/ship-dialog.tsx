import { Loader2, Truck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Dialog,
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
  /** `items` only when a part of what is left goes (F7.10). */
  onConfirm: (notify: boolean, items?: { id: string; quantity: number }[]) => void
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("orders.ship.title", { number: order.display_id })}</DialogTitle>
          <DialogDescription>{t("orders.ship.description")}</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-md border">
          {items.map(({ id, quantity }) => {
            const item = byId.get(id)
            return (
              <li key={id} className="flex items-center gap-3 px-3 py-2.5">
                <ProductThumb src={item?.thumbnail} className="size-9" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{item?.title}</span>
                  {item?.subtitle ? (
                    <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>
                  ) : null}
                </span>
                {packed ? (
                  <span className="text-sm tabular-nums">× {formatCount(quantity)}</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={quantity}
                      aria-label={t("orders.ship.quantityOf", { name: item?.title ?? "" })}
                      className="h-8 w-16 text-right tabular-nums"
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
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={notify}
            onCheckedChange={(checked) => {
              setNotify(checked === true)
            }}
          />
          {t("orders.ship.notify")}
        </label>
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
            disabled={busy || chosen.length === 0}
            onClick={() => {
              onConfirm(notify, whole ? undefined : chosen)
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
