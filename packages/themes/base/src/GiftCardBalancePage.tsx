import type { GiftCardActions, GiftCardBalancePageView, Translate } from "@qticaret/ui"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { PageContainer } from "./components/Container"
import { GiftBalanceForm } from "./components/GiftBalanceForm"

const ERRORS = [
  "gift_card.unknown",
  "gift_card.code_invalid",
  "errors.too_many_requests",
  "errors.challenge_failed",
]

/**
 * `/hediye-karti/bakiye` (adr/0025 Ek 2026-11-03): a gift card's balance by
 * its code. The code goes in the form's body, never in the address.
 */
export function GiftCardBalancePage({
  view,
  t,
  actions,
}: {
  view: GiftCardBalancePageView
  t: Translate
  actions: GiftCardActions
}) {
  return (
    <PageContainer className="flex flex-col gap-6">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <h1 className="text-4xl leading-tight">{view.title}</h1>
          <p className="text-muted-foreground">{view.text}</p>
        </header>
        <div className="rounded-3xl border bg-card p-5 sm:p-6">
          <GiftBalanceForm
            action={actions.checkBalance}
            words={{
              code: t("gift.balance_code"),
              submit: t("gift.balance_submit"),
              working: t("gift.balance_working"),
              checking: t("checkout.checking"),
              errors: Object.fromEntries(ERRORS.map((key) => [key, t(key)])),
              fallback: t("gift.balance_failed"),
            }}
          />
        </div>
      </div>
    </PageContainer>
  )
}
