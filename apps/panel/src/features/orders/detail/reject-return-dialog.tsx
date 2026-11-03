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
import { Textarea } from "@/components/ui/textarea"
import { useRejectReturn } from "@/features/orders/api/returns"
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
