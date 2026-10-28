import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
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
import { returnLinesQuery, useApproveReturn } from "@/features/orders/api/returns"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { differenceText } from "@/features/orders/exchange-text"
import { errorText } from "@/lib/errors"

const R = "orders.returns"

/**
 * Approving a swap (adr/0032 §6): which line goes back for which variant,
 * and what it costs. When the shopper owes, staff say they collected it
 * first; the server checks the difference is still the one shown.
 */
export function ApproveExchangeDialog({
  request,
  onClose,
}: {
  request: ReturnRequest
  onClose: () => void
}) {
  const { t } = useTranslation()
  const approve = useApproveReturn()
  const lines = useQuery(returnLinesQuery(request.order_id))
  const [collected, setCollected] = useState(false)
  const byId = new Map((lines.data ?? []).map((line) => [line.id, line]))
  const owes = Number(request.difference ?? 0) > 0
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(`${R}.exchange.approveTitle`, { number: request.order_display_id ?? "—" })}
          </DialogTitle>
          <DialogDescription>{t(`${R}.exchange.approveDescription`)}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col divide-y rounded-md border">
          {(request.exchange_items ?? []).map((item) => {
            const line = byId.get(item.line_item_id)
            return (
              <li key={item.line_item_id} className="flex flex-col gap-0.5 px-3 py-2.5 text-sm">
                <span className="font-medium">
                  {line?.title ?? "—"} × {item.quantity}
                </span>
                <span className="text-muted-foreground">
                  {t(`${R}.exchange.swap`, {
                    from: line?.variant_title ?? "—",
                    to: item.title ?? "—",
                  })}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="text-sm font-medium">{differenceText(t, request.difference)}</p>
        {owes ? (
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={collected}
              onCheckedChange={(on) => {
                setCollected(on === true)
              }}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{t(`${R}.exchange.collected`)}</span>
              <span className="text-xs text-muted-foreground">
                {t(`${R}.exchange.collectedHint`)}
              </span>
            </span>
          </label>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={approve.isPending || (owes && !collected)}
            onClick={() => {
              approve.mutate(
                { id: request.id, collected },
                {
                  onSuccess: () => {
                    toast.success(t(`${R}.exchange.approved`))
                    onClose()
                  },
                  onError: (failure) => toast.error(errorText(t, failure)),
                }
              )
            }}
          >
            {t(`${R}.approve`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
