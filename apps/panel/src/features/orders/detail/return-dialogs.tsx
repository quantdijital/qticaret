import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { returnLinesQuery, useReceiveReturn, useRejectReturn } from "@/features/orders/api/returns"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { errorText } from "@/lib/errors"

const R = "orders.returns"

/** Turns a request down, with the note the shopper reads (adr/0032). */
export function RejectReturnDialog({
  request,
  onClose,
}: {
  request: ReturnRequest
  onClose: () => void
}) {
  const { t } = useTranslation()
  const reject = useRejectReturn()
  const [note, setNote] = useState("")
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(`${R}.rejectTitle`, { number: request.order_display_id ?? "—" })}
          </DialogTitle>
          <DialogDescription>{t(`${R}.rejectDescription`)}</DialogDescription>
        </DialogHeader>
        <Field label={t(`${R}.rejectNote`)} htmlFor="return-reject-note">
          <Textarea
            id="return-reject-note"
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(event) => {
              setNote(event.target.value)
            }}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={reject.isPending || note.trim() === ""}
            onClick={() => {
              reject.mutate(
                { id: request.id, note: note.trim() },
                {
                  onSuccess: () => {
                    toast.success(t(`${R}.rejected`))
                    onClose()
                  },
                  onError: (failure) => toast.error(errorText(t, failure)),
                }
              )
            }}
          >
            {t(`${R}.reject`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * What reached the warehouse (adr/0032): each asked line's quantity, fewer
 * when some did not come back; received, it is refunded.
 */
export function ReceiveReturnDialog({
  request,
  onClose,
}: {
  request: ReturnRequest
  onClose: () => void
}) {
  const { t } = useTranslation()
  const receive = useReceiveReturn()
  const lines = useQuery(returnLinesQuery(request.order_id))
  const [counts, setCounts] = useState<Record<string, number>>({})
  const byId = new Map((lines.data ?? []).map((line) => [line.id, line]))
  const chosen = request.items
    .map((item) => ({
      line_item_id: item.line_item_id,
      quantity: Math.min(Math.max(counts[item.line_item_id] ?? item.quantity, 0), item.quantity),
    }))
    .filter((item) => item.quantity > 0)
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
            {t(`${R}.receiveTitle`, { number: request.order_display_id ?? "—" })}
          </DialogTitle>
          <DialogDescription>{t(`${R}.receiveDescription`)}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col divide-y rounded-md border">
          {request.items.map((item) => {
            const line = byId.get(item.line_item_id)
            return (
              <li key={item.line_item_id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{line?.title ?? "—"}</span>
                  {line?.variant_title ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {line.variant_title}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={item.quantity}
                    aria-label={t(`${R}.receivedOf`, { name: line?.title ?? "" })}
                    className="h-8 w-16 text-right tabular-nums"
                    value={Math.min(
                      Math.max(counts[item.line_item_id] ?? item.quantity, 0),
                      item.quantity
                    )}
                    onChange={(event) => {
                      setCounts({ ...counts, [item.line_item_id]: Number(event.target.value) || 0 })
                    }}
                  />
                  <span className="tabular-nums">/ {item.quantity}</span>
                </span>
              </li>
            )
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={receive.isPending || chosen.length === 0}
            onClick={() => {
              receive.mutate(
                { id: request.id, items: chosen },
                {
                  onSuccess: (answer) => {
                    if (answer.refund_error) {
                      toast.warning(answer.refund_error)
                    } else {
                      toast.success(t(`${R}.refunded`))
                    }
                    onClose()
                  },
                  onError: (failure) => toast.error(errorText(t, failure)),
                }
              )
            }}
          >
            {t(`${R}.receive`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
