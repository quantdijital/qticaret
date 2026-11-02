import type { StoreLayout } from "@qticaret/types"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import { t } from "@/lib/i18n"
import { faqJsonLd } from "@/lib/seo/faq"
import { JsonLd } from "@/lib/seo/JsonLd"
import { resolvePath } from "@/lib/store-api/requests"
import { homeSections } from "@/lib/views/home"
import type { PreviewPage } from "@/lib/views/preview"
import { theme } from "@/theme"
import { BlogIndexScreen } from "./blog"
import { EntityScreen } from "./entity"
import { queryOf, ShopScreen } from "./shop"

/** The draft's home page, said to be a preview. */
async function DraftHome({ layout }: { layout: StoreLayout }) {
  const sections = await homeSections(layout.home, t)
  return (
    <>
      <JsonLd blocks={faqJsonLd(sections)} />
      <theme.HomePage
        t={t}
        view={{ sections, notice: t("preview.design_notice") }}
        subscribe={subscribeNewsletter}
      />
    </>
  )
}

/**
 * The theme editor's draft on one storefront page (adr/0049): the page
 * drawn as it is live, with the draft's header, footer and sections
 * (`currentLayout()` reads the draft on this address). A path that names
 * no record, or a redirect, shows the draft's home page instead.
 */
export async function DesignPreviewScreen({
  layout,
  target,
}: {
  layout: StoreLayout
  target: PreviewPage
}) {
  switch (target.kind) {
    case "home":
      return <DraftHome layout={layout} />
    case "shop":
      return <ShopScreen query={queryOf(target.url.searchParams)} />
    case "blog":
      return <BlogIndexScreen query={queryOf(target.url.searchParams)} />
    case "resolve": {
      const page = await resolvePath(`${target.url.pathname}${target.url.search}`)
      return page.type === "entity" ? (
        <EntityScreen page={page} url={target.url} />
      ) : (
        <DraftHome layout={layout} />
      )
    }
  }
}
