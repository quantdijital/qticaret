import { CircleAlert, CircleCheck, Download, Printer } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { BoardOrder } from "@/features/orders/api/orders"
import { bulkLabels, useLabelLink } from "@/features/orders/api/shipping"
import type { ShipResult } from "@/features/orders/api/shipping"
import { errorText } from "@/lib/errors"

const S = "orders.bulkShip"

/** One shipped order's label: opened in a new tab, as the order page does. */
function LabelButton({ orderId, fulfillmentId }: { orderId: string; fulfillmentId: string }) {
  const { t } = useTranslation()
  const label = useLabelLink(orderId)
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={label.isPending}
      onClick={() => {
        const tab = window.open("", "_blank")
        label.mutate(fulfillmentId, {
          onSuccess: (url) => {
            if (tab) {
              tab.opener = null
              tab.location.href = url
            } else {
              window.location.assign(url)
            }
          },
          onError: (failure) => {
            tab?.close()
            toast.error(errorText(t, failure))
          },
        })
      }}
    >
      <Download aria-hidden="true" />
      {t(`${S}.label`)}
    </Button>
  )
}

/** Every waiting parcel's label in one PDF, in a new tab to print at once (F7.7). */
function PrintAllButton({ fulfillmentIds }: { fulfillmentIds: string[] }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={() => {
        // Opened at the click, so the browser lets it; filled once the file arrives
        const tab = window.open("", "_blank")
        setBusy(true)
        bulkLabels(fulfillmentIds)
          .then(({ url, missing }) => {
            if (tab) {
              tab.opener = null
              tab.location.href = url
            } else {
              window.location.assign(url)
            }
            // The tab keeps its own copy once loaded
            setTimeout(() => {
              URL.revokeObjectURL(url)
            }, 60_000)
            if (missing > 0) {
              toast.warning(t(`${S}.labelsMissing`, { count: missing }))
            }
          })
          .catch((failure: unknown) => {
            tab?.close()
            toast.error(errorText(t, failure))
          })
          .finally(() => {
            setBusy(false)
          })
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(`${S}.resultsTitle`)}</DialogTitle>
          <DialogDescription>
            {t(`${S}.resultsSummary`, {
              shipped: (results?.length ?? 0) - failed,
              failed,
            })}
          </DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-80 flex-col divide-y overflow-y-auto rounded-md border">
          {(results ?? []).map((result) => (
            <li key={result.order_id} className="flex items-center gap-3 px-3 py-2.5">
              {result.ok ? (
                <CircleCheck className="size-4 shrink-0 text-success-text" aria-hidden="true" />
              ) : (
                <CircleAlert className="size-4 shrink-0 text-destructive-text" aria-hidden="true" />
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
                <LabelButton orderId={result.order_id} fulfillmentId={result.fulfillment_id} />
              ) : null}
            </li>
          ))}
        </ul>
        <DialogFooter>
          {labelled.length > 1 ? <PrintAllButton fulfillmentIds={labelled} /> : null}
          <Button onClick={onClose}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
