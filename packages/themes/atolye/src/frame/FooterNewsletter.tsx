import { drawnVariant, sectionMark } from "@qticaret/ui"
import type { PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { NewsletterBox } from "./NewsletterBox"
import type { JoinedVariant } from "./NewsletterBox"
import { newsletterWords } from "./newsletter-words"

type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

const DRAWN = ["standard", "split", "image_card", "strip", "in_footer"] as const

/**
 * How the footer draws its newsletter box (adr/0049 Ek 2026-11-17
 * e-bülten): `standard` where each footer drew it before; `split`,
 * `image_card` and `strip` as a band of their own at the footer's top;
 * `in_footer` small in the footer's brand (or contact) column. None: the
 * shop took the box out, or the page has no sending.
 */
export const footerNewsletterVariant = (shop: ShopView) =>
  shop.newsletter ? drawnVariant("newsletter", shop.newsletter.variant, DRAWN) : null

/** The footer's box drawn one of the new ways, its ids the footer's (`bulten`). */
export function FooterNewsletterBox({
  shop,
  t,
  subscribe,
  variant,
}: {
  shop: ShopView
  t: Translate
  subscribe: Subscribe
  variant: JoinedVariant
}) {
  const news = shop.newsletter
  if (!news) {
    return null
  }
  return (
    <NewsletterBox
      variant={variant}
      look={{
        variant,
        description: news.description ?? null,
        note: news.note ?? null,
        image: news.image ?? null,
        tone: news.tone ?? "plain",
      }}
      title={news.title}
      headingId="bulten"
      formId="bulten-alt"
      words={newsletterWords(t, news.text)}
      privacyPath={shop.privacyPath}
      subscribe={subscribe}
      marks={Boolean(news.mark)}
      place="footer"
      sectionMark={sectionMark(news.mark)}
    />
  )
}
