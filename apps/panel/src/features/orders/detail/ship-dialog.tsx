import { Loader2, Truck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (notify: boolean) => void
}

/**
 * "Kargoya ver": what goes in the parcel, and whether the customer hears
 * of it. Carrier labels and tracking come with the carrier integrations (F7).
 */
export function ShipDialog({ order, items, open, busy, onOpenChange, onConfirm }: ShipDialogProps) {
  const { t } = useTranslation()
  const [notify, setNotify] = useState(true)
  const byId = new Map(order.items.map((item) => [item.id, item]))
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
                <span className="text-sm tabular-nums">× {formatCount(quantity)}</span>
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
            disabled={busy}
            onClick={() => {
              onConfirm(notify)
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
