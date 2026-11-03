import type { Metadata } from "next"
import type { StorePaymentLink } from "@qticaret/types"
import { openPaymentLink } from "@/app/actions/payment-link"
import { headerCart } from "@/lib/cart/cart"
import { isPaymentLinkCart } from "@/lib/cart/payment-link"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { isNotFound } from "@/lib/store-api/errors"
import { storeGet } from "@/lib/store-api/server"
import { paymentLinkOutcomeOf, paymentLinkTokenOf, paymentLinkView } from "@/lib/views/payment-link"
import { theme } from "@/theme"

/**
 * A customer's own page: nobody's search result, its links not followed,
 * the token in its address told to no page it loads (the Referer; the
 * header is `next.config.ts`'s too). One title whatever the link holds.
 */
export const paymentLinkMetadata: Metadata = {
  ...robotsOnly("noindex,nofollow", t("payment_link.title")),
  referrer: "no-referrer",
}

/**
 * The link as the backend gives it, fresh (no cache: prices and stock);
 * null for the one 404 every unavailable link answers. Reading it spends
 * nothing. Anything else (busy, away) is the error page's.
 */
async function paymentLinkOf(token: string): Promise<StorePaymentLink | null> {
  try {
    const { payment_link } = await storeGet<{ payment_link: StorePaymentLink }>(
      `/store/payment-links/${token}`
    )
    return payment_link
  } catch (error) {
    if (isNotFound(error)) {
      return null
    }
    throw error
  }
}

/**
 * `/ode/<token>` (adr/0051): the order staff prepared, and "Ödemeye geç".
 * A token without the backend's shape asks the backend nothing. Pressing
 * the button replaces the shopper's cart: a cart with lines, unless it is
 * already a link's, is warned of first.
 */
export async function PaymentLinkScreen({ token, outcome }: { token: string; outcome: unknown }) {
  const shaped = paymentLinkTokenOf(token)
  const answer = paymentLinkOutcomeOf(outcome)
  const [link, current] =
    shaped && answer !== "unavailable"
      ? await Promise.all([paymentLinkOf(shaped), headerCart()])
      : [null, null]
  const replacesCart = (current?.items.length ?? 0) > 0 && !isPaymentLinkCart(current?.metadata)
  return (
    <theme.PaymentLinkPage
      t={t}
      action={openPaymentLink}
      view={paymentLinkView(link, { token: shaped ?? "", outcome: answer, replacesCart }, t)}
    />
  )
}
