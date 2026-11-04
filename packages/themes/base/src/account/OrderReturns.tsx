import type { OrderActions, OrderPageView, Translate } from "@qticaret/ui"
import { ReturnForm } from "./ReturnForm"
import type { ReturnWords } from "./ReturnForm"

// The backend's refusals the form says in words (the Server Action passes these through)
const ERRORS = [
  "order.return_reason_required",
  "order.return_items_required",
  "order.return_failed",
  "returns.withdrawal_excluded",
  "returns.gift_card_used",
  "returns.gift_card_separate",
  "returns.already_open",
  "order.return_variant_required",
  "returns.exchange_out_of_stock",
  "returns.exchange_same_variant",
  "returns.exchange_variant_invalid",
  "returns.exchange_discounted_price",
  "errors.too_many_requests",
]

/**
 * The order's return request (F7.9): the shipped lines in one form, a gift
 * card line's withdrawal (adr/0025) in its own, since the backend takes a
 * gift line alone and as money back. With both, the shopper picks one.
 */
export function OrderReturns({
  view,
  t,
  action,
}: {
  view: OrderPageView
  t: Translate
  action: OrderActions["requestReturn"]
}) {
  const lines = view.returnable ?? []
  const goods = lines.filter((line) => !line.gift)
  const gifts = lines.filter((line) => line.gift)
  if (lines.length === 0) {
    return null
  }
  const words = (gift: boolean): ReturnWords => ({
    quantity: t("cart.quantity"),
    reason: t("order.return_reason"),
    note: t("order.return_note"),
    kindReturn: t("order.return_kind_return"),
    kindExchange: t("order.return_kind_exchange"),
    variant: t("order.exchange_variant"),
    exchangeNote: t("order.exchange_note"),
    submit: t("order.return_submit"),
    sending: t("checkout.saving"),
    sent: t(gift ? "order.return_gift_sent" : "order.return_sent"),
    // A gift card's withdrawal sends nothing back
    shipping: gift ? null : (view.returnShippingNote ?? null),
    errors: Object.fromEntries(ERRORS.map((key) => [key, t(key)])),
    fallback: t("order.return_failed"),
  })
  const both = goods.length > 0 && gifts.length > 0
  return (
    <details className="rounded-3xl border bg-card p-6 sm:p-7">
      <summary className="cursor-pointer text-lg font-semibold">
        {t(goods.length > 0 ? "order.return_title" : "order.return_gift_title")}
      </summary>
      <div className="mt-4 flex flex-col gap-6">
        {both && <p className="text-sm text-muted-foreground">{t("order.return_separate")}</p>}
        {goods.length > 0 && (
          <div className="flex flex-col gap-3">
            {both && <h3 className="font-semibold">{t("order.return_goods")}</h3>}
            <ReturnForm view={view} lines={goods} action={action} words={words(false)} />
          </div>
        )}
        {gifts.length > 0 && (
          <div className={both ? "flex flex-col gap-3 border-t pt-6" : "flex flex-col gap-3"}>
            {both && <h3 className="font-semibold">{t("order.return_gift")}</h3>}
            <ReturnForm view={view} lines={gifts} gift action={action} words={words(true)} />
          </div>
        )}
      </div>
    </details>
  )
}
