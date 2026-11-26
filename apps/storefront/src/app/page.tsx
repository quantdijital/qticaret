import type { Metadata } from "next"
import { addToCart } from "@/app/actions/cart"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import { PopupPage } from "@/components/PopupPage"
import { JsonLd } from "@/lib/seo/JsonLd"
import { metadataOf } from "@/lib/seo/metadata"
import { siteSeo } from "@/lib/store-api/requests"
import { homeSections } from "@/lib/views/home"
import { currentLayout } from "@/lib/views/layout"
import { shopWords } from "@/lib/views/theme-settings"
import { theme } from "@/theme"

export async function generateMetadata(): Promise<Metadata> {
  return metadataOf((await siteSeo()).home)
}

/** The home page as the shop laid it out in the theme editor (adr/0049), with its structured data. */
export default async function HomePage() {
  const [site, layout, words] = await Promise.all([siteSeo(), currentLayout(), shopWords()])
  const sections = await homeSections(layout.home, words)
  return (
    <>
      {/* A FAQ section is shown, not written as `FAQPage` data (docs/13 §5, adr/0049 Ek 2026-11-06) */}
      <JsonLd blocks={site.home.jsonLd} />
      <PopupPage kind="home" />
      <theme.HomePage
        t={words}
        view={{ sections }}
        subscribe={subscribeNewsletter}
        quickAdd={addToCart}
      />
    </>
  )
}
