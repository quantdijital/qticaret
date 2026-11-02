import type { Metadata } from "next"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import { t } from "@/lib/i18n"
import { JsonLd } from "@/lib/seo/JsonLd"
import { metadataOf } from "@/lib/seo/metadata"
import { siteSeo } from "@/lib/store-api/requests"
import { homeSections } from "@/lib/views/home"
import { currentLayout } from "@/lib/views/layout"
import { theme } from "@/theme"

export async function generateMetadata(): Promise<Metadata> {
  return metadataOf((await siteSeo()).home)
}

/** The home page as the shop laid it out in the theme editor (adr/0049), with its structured data. */
export default async function HomePage() {
  const [site, layout] = await Promise.all([siteSeo(), currentLayout()])
  const sections = await homeSections(layout.home, t)
  return (
    <>
      <JsonLd blocks={site.home.jsonLd} />
      <theme.HomePage t={t} view={{ sections }} subscribe={subscribeNewsletter} />
    </>
  )
}
