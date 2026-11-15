import type { GiftCardActions, GiftCardBalancePageView, Translate } from "@qticaret/ui"
import { GiftBalanceForm } from "./gift/GiftBalanceForm"
import { Container } from "./parts/Container"
import { Trail } from "./parts/Trail"

const ERRORS = [
  "gift_card.unknown",
  "gift_card.code_invalid",
  "errors.too_many_requests",
  "errors.challenge_failed",
]

/**
 * `/hediye-karti/bakiye` (adr/0025 Ek 2026-11-03): a gift card's balance
 * by its code, in one tinted well under the title. The code goes in the
 * form's body, never in the address.
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
    <Container className="pt-4 lg:pt-6">
      <Trail items={view.breadcrumbs} label={t("nav.breadcrumbs")} />
      <div className="mx-auto mt-4 flex w-full max-w-2xl flex-col gap-6 lg:mt-6">
        <header className="flex flex-col gap-3">
          <h1>{view.title}</h1>
          <p className="max-w-[56ch] text-md text-text-2 lg:text-lead">{view.text}</p>
        </header>
        <div className="rounded-tile gf-pane p-5 sm:p-8">
          <GiftBalanceForm
            action={actions.checkBalance}
            words={{
              code: t("gift.balance_code"),
              placeholder: t("placeholder.gift_card_code"),
              submit: t("gift.balance_submit"),
              working: t("gift.balance_working"),
              checking: t("checkout.checking"),
              errors: Object.fromEntries(ERRORS.map((key) => [key, t(key)])),
              fallback: t("gift.balance_failed"),
            }}
          />
        </div>
      </div>
    </Container>
  )
}
