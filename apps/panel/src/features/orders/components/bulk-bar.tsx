import { FileText, ListChecks, Loader2, PackageCheck, Truck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { BoardOrder } from "@/features/orders/api/orders"
import { MAX_BULK_SHIP, useDeliverOrders, useShipOrders } from "@/features/orders/api/shipping"
import type { ShipResult } from "@/features/orders/api/shipping"
import { MAX_PRINT_ORDERS } from "@/features/orders/api/packing"
import { PrintAllButton } from "@/features/orders/components/ship-results-dialog"
import { openPrint } from "@/features/orders/print/open-print"
import { errorText } from "@/lib/errors"

/**
 * Above the list while orders are picked (F7.7, F12.3): how many, letting
 * go, and what can be done to them at once. Each action counts the picked
 * orders it applies to: labels of parcels waiting for their carrier,
 * "Teslim edildi" for the shop's own deliveries on their way, "Kargoya ver"
 * for those still to ship.
 */
export function BulkBar({
  picked,
  onClear,
  onShipped,
}: {
  picked: ReadonlyMap<string, BoardOrder>
  onClear: () => void
  onShipped: (results: ShipResult[]) => void
}) {
  const { t } = useTranslation()
  const ship = useShipOrders()
  const deliver = useDeliverOrders()
  const orders = [...picked.values()]
  // A parcel waiting for its carrier has its label already
  const labelled = orders.flatMap((order) =>
    order.shipping?.status === "created" ? [order.shipping.fulfillment_id] : []
  )
  const toShip = orders.filter(
    (order) => order.stage === "to_ship" && order.shipping?.status !== "created"
  )
  // A carrier's parcel is delivered by its tracking; the shop's own by hand
  const toDeliver = orders.filter(
    (order) => order.stage === "shipped" && order.delivery?.carrier === null
  )
  const tooMany = toShip.length > MAX_BULK_SHIP
  // Packing slips and the pick list of every picked order, newest first as listed
  const ids = orders.map((order) => order.id)
  const tooManyToPrint = ids.length > MAX_PRINT_ORDERS
  const busy = ship.isPending || deliver.isPending

  const markDelivered = () => {
    deliver.mutate(
      toDeliver.map((order) => order.id),
      {
        onSuccess: (results) => {
          const done = results.filter((result) => result.ok).length
          if (done > 0) {
            toast.success(t("orders.bulk.delivered", { count: done }))
          }
          const failed = results.filter((result) => !result.ok)
          if (failed.length > 0) {
            toast.error(
              t("orders.bulk.notDelivered", {
                count: failed.length,
                reason: failed[0]?.message ?? "",
              })
            )
          }
          onClear()
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  return (
    <div
      role="region"
      aria-label={t("orders.bulkShip.region")}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-muted/60 px-5 py-2.5 text-sm"
    >
      <span className="font-medium" aria-live="polite">
        {t("orders.bulkShip.selected", { count: picked.size })}
      </span>
      {tooMany ? (
        <span className="text-destructive-text">
          {t("orders.bulkShip.tooMany", { max: MAX_BULK_SHIP })}
        </span>
      ) : null}
      {tooManyToPrint ? (
        <span className="text-destructive-text">
          {t("orders.print.tooMany", { max: MAX_PRINT_ORDERS })}
        </span>
      ) : null}
      <span className="ml-auto flex w-full flex-wrap justify-end gap-2 sm:w-auto">
        <Button variant="ghost" size="sm" disabled={busy} onClick={onClear}>
          {t("orders.bulkShip.clear")}
        </Button>
        {labelled.length > 0 ? <PrintAllButton fulfillmentIds={labelled} size="sm" /> : null}
        <Button
          variant="outline"
          size="sm"
          disabled={tooManyToPrint}
          onClick={() => {
            openPrint("slip", ids)
          }}
        >
          <FileText />
          {t("orders.print.slips")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={tooManyToPrint}
          onClick={() => {
            openPrint("pick", ids)
          }}
        >
          <ListChecks />
          {t("orders.print.pickList")}
        </Button>
        {toDeliver.length > 0 ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={markDelivered}>
            {deliver.isPending ? <Loader2 className="animate-spin" /> : <PackageCheck />}
            {t("orders.bulk.deliver", { count: toDeliver.length })}
          </Button>
        ) : null}
        {toShip.length > 0 ? (
          <Button
            size="sm"
            disabled={tooMany || busy}
            onClick={() => {
              ship.mutate(
                { orderIds: toShip.map((order) => order.id), notify: true },
                { onSuccess: onShipped, onError: (failure) => toast.error(errorText(t, failure)) }
              )
            }}
          >
            {ship.isPending ? <Loader2 className="animate-spin" /> : <Truck />}
            {t("orders.bulk.ship", { count: toShip.length })}
          </Button>
        ) : null}
      </span>
    </div>
  )
}
