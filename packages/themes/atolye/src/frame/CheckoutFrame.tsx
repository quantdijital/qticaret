import { ArrowLeft, Lock, Phone, ShoppingBag } from "lucide-react"
import type { ShopView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { WhatsAppGlyph } from "../parts/WhatsAppGlyph"
import { SmallPrint } from "./SmallPrint"
import { Wordmark } from "./Wordmark"

const ROUND =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-pill text-sm font-semibold no-underline"

/** A question while paying: the shop's WhatsApp, else its phone; none when it gave neither. */
function Help({ shop, t }: { shop: ShopView; t: Translate }) {
  const { contact } = shop
  if (contact.whatsappHref) {
    return (
      <a
        href={contact.whatsappHref}
        target="_blank"
        rel="noopener"
        className={`${ROUND} hover:bg-paper-2 sm:border sm:border-edge sm:px-4`}
      >
        <WhatsAppGlyph className="size-5 text-whatsapp" />
        <span className="max-sm:sr-only">{t("whatsapp.label")}</span>
      </a>
    )
  }
  if (contact.phoneHref && contact.phone) {
    return (
      <a
        href={contact.phoneHref}
        className={`${ROUND} hover:bg-paper-2 sm:border sm:border-edge sm:px-4`}
      >
        <Phone className="size-5" aria-hidden="true" strokeWidth={1.75} />
        <span className="sr-only">{t("checkout.header_call")} </span>
        <span className="tabular max-sm:sr-only">{contact.phone}</span>
      </a>
    )
  }
  return null
}

/**
 * The checkout's own header (`/odeme`, the card form, the payment's
 * result; UX denetimi 2026-11-05): nothing to wander off to while
 * paying. The wordmark (home) with "Güvenli ödeme" and a lock beside it;
 * at the end the shop's WhatsApp (else its phone) for a question and the
 * way back to the cart, a bag where the cart always stands on a phone
 * (under 360 px the note drops its lock to stay whole). No search, no
 * categories, no announcement; the row is the shop header's top row
 * (56 px, 80 px from 1024 px), not sticky.
 */
export function CheckoutHeader({ shop, t }: { shop: ShopView; t: Translate }) {
  return (
    <header data-gf-checkout="" className="border-b border-rule bg-paper">
      <Container className="flex h-14 items-center gap-1 sm:gap-4 lg:h-20 lg:gap-6">
        <Wordmark name={shop.name} logo={shop.logo} className="shrink-0" />
        <p className="mr-auto ml-2 flex min-w-0 items-center gap-1.5 text-sm font-semibold text-text-2 max-[22.5rem]:text-xs sm:ml-0 sm:border-l sm:border-rule sm:pl-4 lg:pl-6">
          <Lock
            className="size-4 shrink-0 max-[22.5rem]:hidden"
            aria-hidden="true"
            strokeWidth={2}
          />
          <span className="truncate">{t("checkout.header_secure")}</span>
        </p>
        <Help shop={shop} t={t} />
        <a
          href="/sepet"
          className={`${ROUND} underline-offset-4 max-sm:-mr-2 max-sm:hover:bg-paper-2 sm:hover:underline`}
        >
          <ShoppingBag className="size-6 sm:hidden" aria-hidden="true" strokeWidth={1.75} />
          <ArrowLeft className="size-4 max-sm:hidden" aria-hidden="true" strokeWidth={2} />
          <span className="max-sm:sr-only">{t("checkout.header_back")}</span>
        </a>
      </Container>
    </header>
  )
}

/**
 * The checkout's footer: the shop footer's own small print, the same
 * part (the legal texts, the cookie choices, the year, the title and the
 * identity lines the law asks for); no newsletter, menus or marks to
 * leave the payment by.
 */
export function CheckoutFooter({ shop, t }: { shop: ShopView; t: Translate }) {
  return (
    <footer className="mt-(--footer-gap) border-t border-rule bg-paper-2">
      <Container data-footer-bottom="" className="flex flex-col pb-8 lg:block lg:pt-2">
        <SmallPrint shop={shop} t={t} />
      </Container>
    </footer>
  )
}
