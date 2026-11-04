import {
  Ban,
  CircleDollarSign,
  EllipsisVertical,
  Loader2,
  PackageCheck,
  PackageOpen,
  Pencil,
  ShieldAlert,
  Truck,
  Undo2,
} from "lucide-react"
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
import { useMarkDelivered, useShipOrder } from "@/features/orders/api/orders"
import { useCapturePayment } from "@/features/orders/api/payments"
import type { OrderDetail, OrderMoney, OrderState } from "@/features/orders/api/orders"
import { errorText } from "@/lib/errors"
import { CancelOrderDialog } from "./cancel-order-dialog"
import { ChargebackDialog } from "./chargeback-dialog"
import { EditOrderDialog } from "./edit-dialog"
import { OpenReturnDialog } from "./open-return-dialog"
import { RefundDialog } from "./refund-dialog"
import { ShipDialog } from "./ship-dialog"
import { useReturnOpenable } from "./use-return-openable"

type Dialog =
  "ship" | "deliver" | "cancel" | "capture" | "refund" | "chargeback" | "edit" | "return" | null

/**
 * The next step for the order as the page's main button (ship, then mark
 * delivered); taking the payment, giving money back and canceling sit in
 * the menu, each behind a question (docs/06 §6).
 */
export function OrderActions({
  order,
  state,
  money,
  testPaid = false,
}: {
  order: OrderDetail
  state: OrderState
  money?: OrderMoney | undefined
  /** Paid in a provider's test mode: no real money, so it is not shipped (adr/0027). */
  testPaid?: boolean
}) {
  const { t } = useTranslation()
  const [dialog, setDialog] = useState<Dialog>(null)
  const ship = useShipOrder(order.id)
  const deliver = useMarkDelivered(order.id)
  const capture = useCapturePayment()
  // F12.3: a request opened for the shopper who called, by the shopper's own rules
  const { openable, returnable } = useReturnOpenable(order.id)

  // What the server says can be done now (`/admin/order-board/:id`)
  const toShip = state.ship?.items ?? []
  const parcels = state.deliver
  const held = state.capture
  const cancelable = state.cancelable
  // No real money moved in test mode: only a carrier in test mode, where no courier comes, takes it
  const canShip =
    state.ship !== null && state.stage !== "awaiting_payment" && (!testPaid || state.test_carrier)
  const refundable = money !== undefined && Number(money.refundable) > 0
  // A dispute is against money taken (F6.7)
  const disputable = money !== undefined && Number(money.paid) > 0

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
      {canShip ? (
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
      {held.length > 0 || refundable || disputable || cancelable || openable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label={t("orders.actions.more")}>
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Lines change only before anything is packed (adr/0033), as a cancel does */}
            {cancelable ? (
              <DropdownMenuItem
                onSelect={() => {
                  setDialog("edit")
                }}
              >
                <Pencil />
                {t("orders.actions.edit")}
              </DropdownMenuItem>
            ) : null}
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
            {refundable ? (
              <DropdownMenuItem
                onSelect={() => {
                  setDialog("refund")
                }}
              >
                <Undo2 />
                {t("orders.actions.refund")}
              </DropdownMenuItem>
            ) : null}
            {openable ? (
              <DropdownMenuItem
                onSelect={() => {
                  setDialog("return")
                }}
              >
                <PackageOpen />
                {t("orders.returns.open.button")}
              </DropdownMenuItem>
            ) : null}
            {disputable ? (
              <DropdownMenuItem
                onSelect={() => {
                  setDialog("chargeback")
                }}
              >
                <ShieldAlert />
                {t("orders.actions.chargeback")}
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

      {dialog === "return" && returnable ? (
        <OpenReturnDialog
          orderId={order.id}
          returnable={returnable}
          onClose={() => {
            setDialog(null)
          }}
        />
      ) : null}
      <ShipDialog
        // A fresh dialog each time it opens: no counts left from the last one
        key={dialog === "ship" ? "ship-open" : "ship-closed"}
        order={order}
        items={toShip}
        packed={(state.ship?.fulfillment_id ?? null) !== null}
        open={dialog === "ship"}
        busy={ship.isPending}
        onOpenChange={close}
        onConfirm={(notify, items, tracking) => {
          ship.mutate(
            { notify, ...(items ? { items } : {}), ...(tracking ? { tracking } : {}) },
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
      {dialog === "chargeback" && money ? (
        <ChargebackDialog
          orderId={order.id}
          displayId={order.display_id ?? 0}
          paid={money.paid}
          open
          onOpenChange={close}
        />
      ) : null}
      {dialog === "edit" ? (
        <EditOrderDialog
          order={order}
          onClose={() => {
            setDialog(null)
          }}
        />
      ) : null}
      {/* Mounted while open: each opening is a new refund, with a key of its own */}
      {dialog === "refund" && money ? (
        <RefundDialog order={order} money={money} open onOpenChange={close} />
      ) : null}
      <CancelOrderDialog order={order} open={dialog === "cancel"} onOpenChange={close} />
    </>
  )
}
