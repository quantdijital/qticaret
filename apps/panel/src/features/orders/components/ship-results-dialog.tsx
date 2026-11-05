import { CircleAlert, CircleCheck, Download, Printer } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { BoardOrder } from "@/features/orders/api/orders"
import type { ShipResult } from "@/features/orders/api/shipping"
import { usePrintLabels } from "@/features/orders/components/print-labels"

const S = "orders.bulkShip"

/** One shipped order's label, on the shop's label size, in a new tab. */
function LabelButton({ fulfillmentId }: { fulfillmentId: string }) {
  const { t } = useTranslation()
  const labels = usePrintLabels()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={labels.busy}
      onClick={() => {
        labels.print([fulfillmentId])
      }}
    >
      <Download aria-hidden="true" />
      {t(`${S}.label`)}
    </Button>
  )
}

/** Every waiting parcel's label in one PDF, in a new tab to print at once (F7.7). */
export function PrintAllButton({
  fulfillmentIds,
  size,
}: {
  fulfillmentIds: string[]
  size?: "sm" | "default"
}) {
  const { t } = useTranslation()
  const labels = usePrintLabels()
  return (
    <Button
      variant="outline"
      size={size ?? "default"}
      disabled={labels.busy}
      onClick={() => {
        labels.print(fulfillmentIds)
      }}
    >
      <Printer aria-hidden="true" />
      {t(`${S}.printAll`, { count: fulfillmentIds.length })}
    </Button>
  )
}

/** What "Kargoya ver" did to each picked order (F7.7): shipped with its label, or why not. */
export function ShipResultsDialog({
  results,
  orders,
  onClose,
}: {
  results: ShipResult[] | null
  /** The picked orders as the list showed them, for their numbers. */
  orders: ReadonlyMap<string, BoardOrder>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const failed = (results ?? []).filter((result) => !result.ok).length
  const labelled = (results ?? []).flatMap((result) =>
    result.ok && result.carrier && result.fulfillment_id ? [result.fulfillment_id] : []
  )
  return (
    <Dialog
      open={results !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent pane>
        <DialogHeader>
          <DialogTitle>{t(`${S}.resultsTitle`)}</DialogTitle>
          <DialogDescription>
            {t(`${S}.resultsSummary`, {
              shipped: (results?.length ?? 0) - failed,
              failed,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="flex flex-col divide-y rounded-md border">
            {(results ?? []).map((result) => (
              <li key={result.order_id} className="flex items-center gap-3 px-3 py-2.5">
                {result.ok ? (
                  <CircleCheck className="size-4 shrink-0 text-success-text" aria-hidden="true" />
                ) : (
                  <CircleAlert
                    className="size-4 shrink-0 text-destructive-text"
                    aria-hidden="true"
                  />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium tabular-nums">
                    #{orders.get(result.order_id)?.display_id ?? "—"}
                  </span>
                  {result.ok ? null : (
                    <span className="text-xs text-muted-foreground">
                      {result.message ?? t(`${S}.failed`)}
                    </span>
                  )}
                </span>
                {result.fulfillment_id ? (
                  <LabelButton fulfillmentId={result.fulfillment_id} />
                ) : null}
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          {labelled.length > 1 ? <PrintAllButton fulfillmentIds={labelled} /> : null}
          <Button onClick={onClose}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
