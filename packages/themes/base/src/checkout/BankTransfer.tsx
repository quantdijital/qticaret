import { Landmark } from "lucide-react"
import type { OrderPageView, Translate } from "@qticaret/ui"

/** What a transfer still needs: the account, the amount and the reference. */
export function BankTransfer({ view, t }: { view: OrderPageView; t: Translate }) {
  const bank = view.bankTransfer
  if (!bank) {
    return null
  }
  return (
    <section
      aria-labelledby="havale"
      className="flex flex-col gap-4 rounded-3xl border-2 border-primary/30 bg-primary/5 p-6 sm:p-7"
    >
      <h2 id="havale" className="flex items-center gap-2.5 text-2xl">
        <Landmark className="size-5 text-primary" aria-hidden="true" />
        {t("order.bank_title")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("order.bank_text", { hours: bank.deadlineHours, id: view.displayId })}
      </p>
      <dl className="tabular grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-4">
          <dt className="text-xs text-muted-foreground">{t("order.bank_name")}</dt>
          <dd className="font-medium">{bank.bankName}</dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-4">
          <dt className="text-xs text-muted-foreground">{t("order.bank_holder")}</dt>
          <dd className="font-medium">{bank.accountHolder}</dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-4 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">IBAN</dt>
          <dd className="font-mono text-base font-semibold tracking-wide select-all">
            {bank.iban}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-4">
          <dt className="text-xs text-muted-foreground">{t("order.bank_amount")}</dt>
          <dd className="text-base font-semibold">{bank.amount}</dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-4">
          <dt className="text-xs text-muted-foreground">{t("order.bank_reference")}</dt>
          <dd className="text-base font-semibold">#{view.displayId}</dd>
        </div>
      </dl>
    </section>
  )
}
