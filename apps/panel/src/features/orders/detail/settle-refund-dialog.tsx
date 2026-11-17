import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { useSettleRefund } from "@/features/orders/api/orders"
import type { ShopRefund } from "@/features/orders/api/payments"
import { errorText } from "@/lib/errors"

const S = "orders.refunds.settle"

type Outcome = "made" | "not_made"

/**
 * A refund whose record stayed incomplete, checked by staff in the
 * provider's panel (review 2026-11-17, O2): did the money go back? "It
 * went" closes it; "it did not" frees its lines to be refunded again.
 * Nothing is sent from here.
 */
export function SettleRefundDialog({
  orderId,
  refund,
  currency,
  onOpenChange,
}: {
  orderId: string
  refund: ShopRefund | null
  currency: string
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const settle = useSettleRefund(orderId)
  const [chosen, setChosen] = useState<Outcome | null>(null)
  const answer = (outcome: Outcome) => {
    if (!refund) {
      return
    }
    setChosen(outcome)
    settle.mutate(
      { reference: refund.reference, outcome },
      {
        onSuccess: () => {
          toast.success(t(`${S}.done.${outcome}`))
          onOpenChange(false)
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <Dialog open={refund !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${S}.title`)}</DialogTitle>
          <DialogDescription>
            {t(`${S}.question`, { amount: refund ? formatMoney(refund.amount, currency) : "" })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-[13px] text-muted-foreground">{t(`${S}.hint`)}</p>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={settle.isPending}
            onClick={() => {
              answer("not_made")
            }}
          >
            {settle.isPending && chosen === "not_made" ? (
              <Loader2 className="animate-spin" />
            ) : null}
            {t(`${S}.not_made`)}
          </Button>
          <Button
            disabled={settle.isPending}
            onClick={() => {
              answer("made")
            }}
          >
            {settle.isPending && chosen === "made" ? <Loader2 className="animate-spin" /> : null}
            {t(`${S}.made`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
