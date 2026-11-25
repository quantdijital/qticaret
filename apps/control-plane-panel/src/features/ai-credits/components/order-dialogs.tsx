import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PAYMENT_METHODS } from "@qticaret/types/control-plane"
import type { PaymentMethod } from "@qticaret/types/control-plane"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { money } from "@/features/billing/words"
import { useMarkPaid } from "@/features/ai-credits/api/mutations"
import type { AiOrder } from "@/features/ai-credits/api/schemas"
import { credits, shopName } from "@/features/ai-credits/words"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

// The control plane's bound on a payment's reference
const REFERENCE_MAX = 256

/** What a request's dialogs say of it: the shop, the pack, its credits and amount. */
function factsOf(t: ReturnType<typeof useTranslation>["t"], order: AiOrder) {
  return {
    shop: shopName(order),
    pack: order.pack.name,
    credits: credits(t, order.pack.credits),
    amount: money(order.pack.amount, order.pack.currency),
  }
}

/**
 * "Ödendi olarak işaretle" (adr/0085 K11): how it was paid and the
 * receipt's reference, the dialog saying what will happen ("X mağazasına
 * N kredi yüklenecek"). One request on submit, behind a step-up; marked
 * twice, the credits are added once (`applied: false`).
 */
export function PaidDialog({ order, onClose }: { order: AiOrder; onClose: () => void }) {
  const { t } = useTranslation()
  const mark = useMarkPaid(order)
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer")
  const [reference, setReference] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("aiCredits.orders.paid.title")}
      description={t("aiCredits.orders.paid.text", factsOf(t, order))}
      dirty
      saving={mark.isPending}
      submitLabel={t("aiCredits.orders.paid.submit")}
      onSubmit={() => {
        if (mark.isPending) {
          return
        }
        setFailure(null)
        mark.mutate(
          { method, reference },
          {
            onSuccess: (done) => {
              toast.success(
                done.applied ? t("aiCredits.orders.paid.done") : t("aiCredits.orders.paid.already")
              )
              onClose()
            },
            onError: (error) => {
              if (!isStepUpCancelled(error)) {
                setFailure(errorText(t, error))
              }
            },
          }
        )
      }}
    >
      <DialogBody>
        <div className="flex flex-col gap-2">
          <p id="order-method-label" className="text-sm font-medium">
            {t("aiCredits.orders.paid.method")}
          </p>
          <RadioGroup
            aria-labelledby="order-method-label"
            value={method}
            onValueChange={(next) => {
              setMethod(next as PaymentMethod)
            }}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            {PAYMENT_METHODS.map((each) => (
              <div key={each} className="flex items-center gap-2">
                <RadioGroupItem id={`order-method-${each}`} value={each} />
                <Label htmlFor={`order-method-${each}`} className="font-normal">
                  {t(`billing.method.${each}`)}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="order-reference">{t("aiCredits.orders.paid.reference")}</Label>
          <Input
            id="order-reference"
            maxLength={REFERENCE_MAX}
            value={reference}
            onChange={(event) => {
              setReference(event.target.value)
            }}
          />
          <p className="text-[13px] text-muted-foreground">
            {t("aiCredits.orders.paid.referenceHelp")}
          </p>
        </div>
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}

/**
 * "İptal et": asked first, naming the shop, the pack, its credits and
 * amount. Only the question: the page that stays on screen sends it
 * (behind a step-up) and says the answer, so closing this loses nothing.
 */
export function CancelDialog({
  order,
  onConfirm,
  onClose,
}: {
  order: AiOrder
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("aiCredits.orders.cancel.title")}
      description={t("aiCredits.orders.cancel.text", factsOf(t, order))}
      confirmLabel={t("aiCredits.orders.cancel.confirm")}
      destructive
      onConfirm={onConfirm}
    />
  )
}
