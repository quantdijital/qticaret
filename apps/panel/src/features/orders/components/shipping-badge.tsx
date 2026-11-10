import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { BoardOrder, ShipmentStatus } from "@/features/orders/api/orders"

const TONES: Record<ShipmentStatus, StatusTone> = {
  created: "info",
  picked_up: "info",
  in_transit: "info",
  out_for_delivery: "info",
  delivered: "success",
  returned: "warning",
  failed: "danger",
  canceled: "neutral",
}

/** Where the order's carrier parcel stands (adr/0031), its tracking number on hover. */
export function ShippingBadge({ shipping }: { shipping: BoardOrder["shipping"] }) {
  const { t } = useTranslation()
  if (!shipping) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span title={shipping.tracking_number ?? undefined}>
      <StatusBadge tone={TONES[shipping.status]}>
        {t(`orders.shipping.${shipping.status}`)}
      </StatusBadge>
    </span>
  )
}

/**
 * The order list's shipping cell (F7.7): the parcel's state once it has
 * one; before that the option the shopper chose, and whether "Kargoya ver"
 * prints a label for it or the shop delivers it itself.
 */
export function OrderShipping({ order }: { order: Pick<BoardOrder, "shipping" | "delivery"> }) {
  const { t } = useTranslation()
  if (order.shipping || !order.delivery) {
    return <ShippingBadge shipping={order.shipping} />
  }
  const how = order.delivery.carrier ? "labelled" : order.delivery.pickup ? "pickup" : "own"
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-sm">{order.delivery.name}</span>
      <span className="truncate text-xs text-muted-foreground">{t(`orders.delivery.${how}`)}</span>
    </div>
  )
}
