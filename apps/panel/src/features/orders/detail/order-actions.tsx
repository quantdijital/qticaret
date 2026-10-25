import { Ban, CircleDollarSign, EllipsisVertical, Loader2, PackageCheck, Truck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useCancelOrder,
  useCapturePayment,
  useMarkDelivered,
  useShipOrder,
} from "@/features/orders/api/orders"
import type { OrderDetail } from "@/features/orders/api/orders"
import {
  inTransit,
  isPaid,
  lifecycleOf,
  uncaptured,
  unshippedItems,
} from "@/features/orders/order-math"
import type { OrderFacts } from "@/features/orders/order-math"
import { errorText } from "@/lib/errors"
import { ShipDialog } from "./ship-dialog"

type Dialog = "ship" | "deliver" | "cancel" | "capture" | null

/**
 * The next step for the order as the page's main button (ship, then mark
 * delivered); taking the payment and canceling sit in the menu, each
 * behind a question (docs/06 §6).
 */
export function OrderActions({ order }: { order: OrderDetail }) {
  const { t } = useTranslation()
  const [dialog, setDialog] = useState<Dialog>(null)
  const ship = useShipOrder(order.id)
  const deliver = useMarkDelivered(order.id)
  const cancel = useCancelOrder(order.id)
  const capture = useCapturePayment(order.id)

  const facts = order as unknown as OrderFacts
  const stage = lifecycleOf(facts)
  const toShip = stage === "canceled" ? [] : unshippedItems(facts)
  const parcels = inTransit(facts)
  const held = stage === "canceled" ? [] : uncaptured(facts)
  const cancelable =
    stage === "awaiting_payment" ||
    (stage === "to_ship" && toShip.length > 0 && parcels.length === 0)

  const done = (message: string) => () => {
    setDialog(null)
    toast.success(t(message))
  }
  const failed = (failure: unknown) => {
    toast.error(errorText(t, failure))
  }
  const close = (open: boolean) => {
    if (!open) {
      setDialog(null)
    }
  }

  return (
    <>
      {toShip.length > 0 && isPaid(facts) ? (
        <Button
          onClick={() => {
            setDialog("ship")
          }}
        >
          <Truck />
          {t("orders.actions.ship")}
        </Button>
      ) : parcels.length > 0 ? (
        <Button
          disabled={deliver.isPending}
          onClick={() => {
            setDialog("deliver")
          }}
        >
          {deliver.isPending ? <Loader2 className="animate-spin" /> : <PackageCheck />}
          {t("orders.actions.deliver")}
        </Button>
      ) : null}
      {held.length > 0 || cancelable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label={t("orders.actions.more")}>
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {held.length > 0 ? (
              <DropdownMenuItem
                onSelect={() => {
                  setDialog("capture")
                }}
              >
                <CircleDollarSign />
                {t("orders.actions.capture")}
              </DropdownMenuItem>
            ) : null}
            {cancelable ? (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setDialog("cancel")
                }}
              >
                <Ban />
                {t("orders.actions.cancel")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <ShipDialog
        order={order}
        items={toShip}
        open={dialog === "ship"}
        busy={ship.isPending}
        onOpenChange={close}
        onConfirm={(notify) => {
          ship.mutate(
            { items: toShip, notify },
            { onSuccess: done("orders.ship.done"), onError: failed }
          )
        }}
      />
      <ConfirmDialog
        open={dialog === "deliver"}
        onOpenChange={close}
        title={t("orders.deliver.title")}
        description={t("orders.deliver.description")}
        confirmLabel={t("orders.actions.deliver")}
        onConfirm={() => {
          deliver.mutate(parcels, { onSuccess: done("orders.deliver.done"), onError: failed })
        }}
      />
      <ConfirmDialog
        open={dialog === "capture"}
        onOpenChange={close}
        title={t("orders.capture.title")}
        description={t("orders.capture.description")}
        confirmLabel={t("orders.actions.capture")}
        onConfirm={() => {
          capture.mutate(held, { onSuccess: done("orders.capture.done"), onError: failed })
        }}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={close}
        title={t("orders.cancel.title", { number: order.display_id })}
        description={t("orders.cancel.description")}
        confirmLabel={t("orders.actions.cancel")}
        destructive
        onConfirm={() => {
          cancel.mutate(undefined, { onSuccess: done("orders.cancel.done"), onError: failed })
        }}
      />
    </>
  )
}
