import type { ReactNode } from "react"
import type { ShopView, Translate } from "@qticaret/ui"
import { Container } from "./components/Container"
import { AnnouncementBar } from "./layout/AnnouncementBar"
import { SiteFooter } from "./layout/SiteFooter"
import { SiteHeader } from "./layout/SiteHeader"
import { WhatsAppButton } from "./layout/WhatsAppButton"

/**
 * The frame every page shares (D3, docs/19 §4): a skip link, the
 * announcement bar, the header with search, cart and categories, the
 * page, the footer, and the WhatsApp button when the shop gave a number.
 */
export function Layout({
  shop,
  t,
  children,
}: {
  shop: ShopView
  t: Translate
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {t("nav.skip_to_content")}
      </a>
      <AnnouncementBar lines={shop.announcements} label={t("nav.announcements")} />
      <SiteHeader shop={shop} t={t} />
      <main id="icerik" className="flex-1">
        <Container className="py-6 lg:py-10">{children}</Container>
      </main>
      <SiteFooter shop={shop} t={t} />
      {shop.contact.whatsappHref && (
        <WhatsAppButton href={shop.contact.whatsappHref} label={t("whatsapp.label")} />
      )}
    </div>
  )
}
