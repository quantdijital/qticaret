import { useIsMutating } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
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
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  CLOSE_GIFT_CARD,
  cardBalance,
  maskCode,
  useCloseGiftCard,
} from "@/features/gift-cards/api/gift-cards"
import type { GiftCard } from "@/features/gift-cards/api/gift-cards"
import { errorText } from "@/lib/errors"
import { formatMoney } from "@qticaret/admin-ui/lib/format"

const C = "giftCards.close"
const REASON_MAX = 200

/** The reason and the confirmation; the movement's note says it was closed here, and why. */
function CloseForm({ card, onDone }: { card: GiftCard; onDone: () => void }) {
  const { t } = useTranslation()
  const close = useCloseGiftCard()
  const [reason, setReason] = useState("")
  const submit = () => {
    const accountId = card.store_credit_account?.id
    if (!accountId) {
      return
    }
    const why = reason.trim()
    close.mutate(
      { accountId, note: why ? t(`${C}.noteWith`, { reason: why }) : t(`${C}.note`) },
      {
        onSuccess: (amount) => {
          toast.success(
            amount > 0
              ? t(`${C}.done`, { amount: formatMoney(amount, card.currency_code) })
              : t(`${C}.empty`)
          )
          onDone()
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <DialogBody>
        <Field
          label={t(`${C}.reason`)}
          htmlFor="gift-card-close-reason"
          hint={t(`${C}.reasonHint`)}
        >
          <Input
            id="gift-card-close-reason"
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
            }}
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="cancel" disabled={close.isPending} onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="destructive" disabled={close.isPending}>
          {close.isPending ? <Loader2 className="animate-spin" /> : null}
          {t(`${C}.confirm`)}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * "Kartı kapat" (adr/0025 Ek 2026-11-03): after a refund or a cancelled
 * order, what is left on the card is debited to zero; it cannot be taken
 * back, and the ledger keeps the movement.
 */
export function CloseGiftCardDialog({
  card,
  onClose,
}: {
  card: GiftCard | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  // Stays open while the debit is on its way: its answer is said here
  const closing = useIsMutating({ mutationKey: CLOSE_GIFT_CARD }) > 0
  return (
    <Dialog
      open={card !== null}
      onOpenChange={(open) => {
        if (!open && !closing) {
          onClose()
        }
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t(`${C}.title`)}</DialogTitle>
          <DialogDescription>
            {card
              ? t(`${C}.description`, {
                  code: maskCode(card.code),
                  amount: formatMoney(cardBalance(card), card.currency_code),
                })
              : null}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed by card: a reason typed for one is not carried to the next */}
        {card ? <CloseForm key={card.id} card={card} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}
