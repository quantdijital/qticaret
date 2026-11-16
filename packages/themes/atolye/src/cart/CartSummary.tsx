import { Lock } from "lucide-react"
import type { CartPageView, ThemeActions, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { TrustIcon } from "../parts/TrustIcon"
import { promotionWords } from "./code-words"
import { CodeForm } from "./CodeForm"

const GIFT_CARD_ERRORS = ["cart.gift_card_invalid", "errors.too_many_requests"]

function Row({
  term,
  value,
  deal = false,
  quiet = false,
}: {
  term: string
  value: string
  deal?: boolean
  quiet?: boolean
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", deal && "text-deal")}>
      <dt className={deal ? undefined : "text-text-2"}>{term}</dt>
      <dd className={cn("tabular text-right font-semibold", quiet && "font-normal text-text-2")}>
        {value}
      </dd>
    </div>
  )
}

/**
 * The cart's totals beside its lines, a tinted well that stays in sight
 * on a desktop: the codes (a coupon; a gift card while the shop sells
 * them), items, discount, gift card, shipping as the backend prices it
 * before an address, the subtotal large, then "Ödemeye geç" (on a phone
 * the sticky bar holds it) and the shop's promises under the well. A
 * wholesaler's (ADR-0068 §5): the items without KDV, the KDV as its own
 * row, a note under the subtotal.
 */
export function CartSummary({
  view,
  t,
  actions,
}: {
  view: CartPageView
  t: Translate
  actions: ThemeActions
}) {
  const locked = Boolean(view.locked)
  const trust = view.trust ?? []
  return (
    <aside aria-labelledby="sepet-ozeti" className="flex flex-col gap-4 lg:sticky lg:top-44">
      <div className="flex flex-col gap-6 rounded-tile gf-box p-5 sm:p-7">
        <h2 id="sepet-ozeti" className="text-title">
          {t("cart.summary")}
        </h2>
        {!locked && (
          <CodeForm
            id="kupon"
            codes={view.promotions}
            apply={actions.applyPromotion}
            remove={actions.removePromotion}
            words={promotionWords(t)}
          />
        )}
        {view.giftCards && actions.applyGiftCard && actions.removeGiftCard && (
          <CodeForm
            id="hediye-karti"
            codes={view.giftCards}
            apply={actions.applyGiftCard}
            remove={actions.removeGiftCard}
            words={{
              label: t("cart.gift_card_label"),
              placeholder: t("placeholder.gift_card_code"),
              apply: t("cart.promotion_apply"),
              remove: t("cart.promotion_remove"),
              applied: t("cart.gift_card_applied"),
              errors: Object.fromEntries(GIFT_CARD_ERRORS.map((key) => [key, t(key)])),
              fallback: t("cart.gift_card_invalid"),
            }}
          />
        )}
        <dl className="flex flex-col gap-3 text-md">
          {view.tax ? (
            <Row term={t("cart.items_net")} value={view.tax.items} />
          ) : (
            <Row term={t("cart.items")} value={view.items} />
          )}
          {view.discount && <Row term={t("cart.discount")} value={`−${view.discount}`} deal />}
          {view.tax && <Row term={t("cart.vat")} value={view.tax.vat} />}
          {view.credit && <Row term={t("cart.gift_card_credit")} value={`−${view.credit}`} deal />}
          <Row
            term={t("cart.shipping")}
            value={view.shipping ?? t("cart.shipping_at_checkout")}
            quiet={!view.shipping}
          />
          <div className="mt-2 flex items-baseline justify-between gap-4 rounded-media gf-shape bg-paper p-4">
            <dt className="font-semibold">
              {t(view.tax ? "cart.subtotal_with_vat" : "cart.subtotal")}
            </dt>
            <dd className="tabular text-title font-extrabold">{view.subtotal}</dd>
          </div>
        </dl>
        {view.tax && <p className="text-sm text-text-2">{view.tax.note}</p>}
        <div className="flex flex-col gap-3 max-lg:hidden">
          <a href="/odeme" className="gf-btn w-full">
            {t("cart.checkout")}
          </a>
          <p className="flex items-center justify-center gap-2 text-sm text-text-2">
            <Lock className="size-4" aria-hidden="true" strokeWidth={2} />
            {t("cart.secure")}
          </p>
        </div>
      </div>
      {trust.length > 0 && (
        <ul aria-label={t("cart.trust")} className="grid gap-x-4 gap-y-3 px-1 sm:grid-cols-2">
          {trust.map((badge) => (
            <li key={badge.title} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-paper-2">
                <TrustIcon icon={badge.icon} className="size-5 shrink-0" />
              </span>
              <span className="flex min-w-0 flex-col text-sm leading-snug">
                <span className="font-extrabold">{badge.title}</span>
                {badge.text && <span className="text-text-2">{badge.text}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
