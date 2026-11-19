import { useIsMutating } from "@tanstack/react-query"
import { Check, Copy, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
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
import { CREATE_GIFT_CARD, useCreateGiftCard } from "@/features/gift-cards/api/gift-cards"
import type { GiftCard } from "@/features/gift-cards/api/gift-cards"
import { errorText } from "@/lib/errors"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"

/** The new card's code, to copy and hand to the customer. */
function MadeCard({ card }: { card: GiftCard }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/40 p-4">
      <span className="text-sm text-muted-foreground">
        {t("giftCards.made", { amount: formatMoney(card.value, card.currency_code) })}
      </span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-lg tracking-wider select-all">{card.code}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("giftCards.copy")}
          onClick={() => {
            // Refused without the page's clipboard permission: the code stays selectable
            navigator.clipboard.writeText(card.code).then(
              () => {
                setCopied(true)
              },
              () => toast.error(t("giftCards.copyFailed"))
            )
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  )
}

interface Draft {
  value: string
  note: string
}

const EMPTY: Draft = { value: "", note: "" }

/** Value and the shop's note; cards do not expire (adr/0025). */
function GiftCardFields({
  draft,
  onChange,
  error,
}: {
  draft: Draft
  onChange: (draft: Draft) => void
  error: string | undefined
}) {
  const { t } = useTranslation()
  return (
    <>
      <Field label={t("giftCards.value")} htmlFor="gift-card-value" error={error} required>
        <NumberField
          id="gift-card-value"
          decimals={2}
          min={0}
          suffix="₺"
          autoFocus
          className="w-48"
          value={draft.value}
          onChange={(event) => {
            onChange({ ...draft, value: event.target.value })
          }}
        />
      </Field>
      <Field label={t("giftCards.note")} htmlFor="gift-card-note" hint={t("giftCards.noteHint")}>
        <Input
          id="gift-card-note"
          maxLength={200}
          value={draft.note}
          onChange={(event) => {
            onChange({ ...draft, note: event.target.value })
          }}
        />
      </Field>
    </>
  )
}

/** The form: a card of a value, with a note for the shop. */
function NewCardForm({
  onMade,
  onCancel,
}: {
  onMade: (card: GiftCard) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const create = useCreateGiftCard()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState<string | undefined>()
  const submit = () => {
    const amount = parseMoneyInput(draft.value)
    if (amount === null || amount < 1) {
      setError(t("giftCards.errors.value"))
      return
    }
    create.mutate(
      { value: amount, note: draft.note.trim() || null },
      { onSuccess: onMade, onError: (failure) => toast.error(errorText(t, failure)) }
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
        <GiftCardFields
          draft={draft}
          error={error}
          onChange={(next) => {
            setDraft(next)
            setError(undefined)
          }}
        />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="cancel" disabled={create.isPending} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("giftCards.create")}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** A new card, then its code to hand over. Stays open while the card is being made. */
export function NewGiftCardDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const creating = useIsMutating({ mutationKey: CREATE_GIFT_CARD }) > 0
  const [made, setMade] = useState<GiftCard | null>(null)
  const close = () => {
    onOpenChange(false)
    setMade(null)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !creating) {
          close()
        }
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("giftCards.new")}</DialogTitle>
          <DialogDescription>{t("giftCards.newHint")}</DialogDescription>
        </DialogHeader>
        {made ? (
          <>
            <MadeCard card={made} />
            <DialogFooter>
              <Button onClick={close}>{t("common.close")}</Button>
            </DialogFooter>
          </>
        ) : (
          <NewCardForm onMade={setMade} onCancel={close} />
        )}
      </DialogContent>
    </Dialog>
  )
}
