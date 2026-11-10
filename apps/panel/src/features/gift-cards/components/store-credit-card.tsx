import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { storeCreditQuery, useCreditCustomer } from "@/features/gift-cards/api/store-credit"
import { errorText } from "@/lib/errors"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"

/** The amount in lira and an optional note, side by side. */
function CreditInputs({
  amount,
  note,
  onAmount,
  onNote,
}: {
  amount: string
  note: string
  onAmount: (amount: string) => void
  onNote: (note: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-2">
      <NumberField
        id="store-credit-amount"
        decimals={2}
        min={0}
        suffix="₺"
        className="w-44 shrink-0"
        value={amount}
        onChange={(event) => {
          onAmount(event.target.value)
        }}
      />
      <Input
        aria-label={t("storeCredit.note")}
        placeholder={t("storeCredit.note")}
        maxLength={200}
        value={note}
        onChange={(event) => {
          onNote(event.target.value)
        }}
      />
    </div>
  )
}

/** An amount and a note onto the customer's account; the account is opened on the first. */
function CreditForm({ customerId, accountId }: { customerId: string; accountId: string | null }) {
  const { t } = useTranslation()
  const credit = useCreditCustomer(customerId)
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const value = parseMoneyInput(amount)
  const valid = value !== null && value > 0
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!valid) {
          return
        }
        credit.mutate(
          { accountId, amount: value, note: note.trim() },
          {
            onSuccess: () => {
              setAmount("")
              setNote("")
              toast.success(t("storeCredit.added", { amount: formatMoney(value, "try") }))
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
    >
      <label htmlFor="store-credit-amount" className="text-sm font-medium">
        {t("storeCredit.add")}
      </label>
      <CreditInputs amount={amount} note={note} onAmount={setAmount} onNote={setNote} />
      <div>
        <Button type="submit" size="sm" disabled={!valid || credit.isPending}>
          {credit.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("storeCredit.submit")}
        </Button>
      </div>
    </form>
  )
}

/**
 * The customer's store credit (F4.8): what is on their account to spend at
 * checkout, and a way to add to it (a refund taken as credit, a goodwill
 * amount). Every credit is in the audit log with the balance before and after.
 */
export function StoreCreditCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  const account = useQuery(storeCreditQuery(customerId))
  return (
    <SectionCard title={t("storeCredit.title")} description={t("storeCredit.hint")}>
      {account.isError && !account.data ? (
        <ErrorState text={errorText(t, account.error)} onRetry={() => void account.refetch()} />
      ) : account.isPending ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-2xl font-semibold tabular-nums">
            {formatMoney(account.data?.balance ?? 0, "try")}
          </p>
          <CreditForm customerId={customerId} accountId={account.data?.id ?? null} />
        </div>
      )}
    </SectionCard>
  )
}
