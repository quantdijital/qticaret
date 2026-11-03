import { useQuery } from "@tanstack/react-query"
import { Gift, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
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
import { returnLinesQuery, useApproveReturn } from "@/features/orders/api/returns"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { errorText } from "@/lib/errors"

const G = "orders.returns.gift"

/** What a gift card withdrawal does (adr/0025 Ek 2026-11-03): nothing travels, the money goes at once. */
export function GiftReturnNote() {
  const { t } = useTranslation()
  return (
    <p className="flex items-start gap-2 rounded-md bg-info-soft px-3 py-2 text-[13px] text-info-text">
      <Gift className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {t(`${G}.note`)}
    </p>
  )
}

/**
 * Approving a withdrawal from gift cards (adr/0025 Ek 2026-11-03): as many
 * untouched cards as asked are voided, the request is received at once and
 * its money given back; no parcel is waited for. Asked first, since it
 * cannot be taken back. A refund that fails leaves the cards voided and
 * the request received, its reason said with how to try again; a card
 * spent since the request makes the server refuse it.
 */
export function ApproveGiftReturnDialog({
  request,
  onClose,
}: {
  request: ReturnRequest
  onClose: () => void
}) {
  const { t } = useTranslation()
  const approve = useApproveReturn()
  const lines = useQuery(returnLinesQuery(request.order_id))
  const byId = new Map((lines.data ?? []).map((line) => [line.id, line]))
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
          <DialogTitle>{t(`${G}.title`, { number: request.order_display_id ?? "—" })}</DialogTitle>
          <DialogDescription>{t(`${G}.description`)}</DialogDescription>
        </DialogHeader>
        <DialogBody list>
          <ul className="flex flex-col divide-y rounded-md border">
            {request.items.map((item) => (
              <li
                key={item.line_item_id}
                className="flex min-h-12 items-center justify-between gap-3 px-3 py-1.5 text-sm"
              >
                <span className="truncate font-medium">
                  {byId.get(item.line_item_id)?.title ?? "—"}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {t(`${G}.cards`, { count: item.quantity })}
                </span>
              </li>
            ))}
          </ul>
          <GiftReturnNote />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={approve.isPending}
            onClick={() => {
              approve.mutate(
                { id: request.id },
                {
                  onSuccess: (answer) => {
                    if (answer.refund_error) {
                      toast.warning(t(`${G}.refundFailed`, { reason: answer.refund_error }))
                    } else {
                      toast.success(t(`${G}.done`))
                    }
                    onClose()
                  },
                  onError: (failure) => toast.error(errorText(t, failure)),
                }
              )
            }}
          >
            {approve.isPending ? <Loader2 className="animate-spin" /> : null}
            {t(`${G}.confirm`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
