import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { useCancelReturn } from "@/features/orders/api/returns"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { errorText } from "@/lib/errors"

const R = "orders.returns"

/**
 * Takes an approval back while nothing has come back (order #691): the
 * shopper gave up, or it was a mistake. The carrier's code stops working,
 * the lines can be asked again and the shopper is told by e-mail; the
 * reason stays with the team.
 */
export function CancelReturnDialog({
  request,
  onClose,
}: {
  request: ReturnRequest
  onClose: () => void
}) {
  const { t } = useTranslation()
  const cancel = useCancelReturn()
  const [reason, setReason] = useState("")
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {t(`${R}.cancelTitle`, { number: request.order_display_id ?? "—" })}
          </DialogTitle>
          <DialogDescription>{t(`${R}.cancelDescription`)}</DialogDescription>
        </DialogHeader>
        <Field
          label={t(`${R}.cancelReason`)}
          htmlFor="return-cancel-reason"
          hint={t(`${R}.cancelReasonHint`)}
        >
          <Textarea
            id="return-cancel-reason"
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
            }}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={cancel.isPending || reason.trim() === ""}
            onClick={() => {
              cancel.mutate(
                { id: request.id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success(t(`${R}.canceled`))
                    onClose()
                  },
                  onError: (failure) => toast.error(errorText(t, failure)),
                }
              )
            }}
          >
            {t(`${R}.cancel`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
