import type { StoreLayout } from "@qticaret/types"
import { addToCart } from "@/app/actions/cart"
import CartPage from "@/app/sepet/page"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import { t } from "@/lib/i18n"
import { resolvePath } from "@/lib/store-api/requests"
import { homeSections } from "@/lib/views/home"
import { shopWords } from "@/lib/views/theme-settings"
import { draftContentPage } from "@/lib/views/page-sections"
import type { PreviewPage } from "@/lib/views/preview"
import { theme } from "@/theme"
import { BlogIndexScreen } from "./blog"
import { ContentScreen } from "./content"
import { EntityScreen } from "./entity"
import { SearchScreen } from "./search"
import { queryOf, ShopScreen } from "./shop"

/** The draft's home page, said to be a preview (but in a card's picture). */
async function DraftHome({ layout, notice }: { layout: StoreLayout; notice: string | null }) {
  const words = await shopWords()
  const sections = await homeSections(layout.home, words)
  return (
    <theme.HomePage
      t={words}
      view={{ sections, notice }}
      subscribe={subscribeNewsletter}
      // As live and as the draft's other pages: a one-variant card says "Sepete ekle" (Z-02)
      quickAdd={addToCart}
    />
  )
}

/**
 * The theme editor's draft on one storefront page (adr/0049): the page
 * drawn as it is live, with the draft's header, footer and sections
 * (`currentLayout()` reads the draft on this address). A path that names
 * no record, or a redirect, shows the draft's home page instead. The
 * live session also opens a content page by its id, a draft one too
 * (adr/0073 §5); one it does not open shows the draft's home page.
 */
export async function DesignPreviewScreen({
  layout,
  target,
  notice = t("preview.design_notice"),
}: {
  layout: StoreLayout
  target: PreviewPage
  /** What the home page says it is: the draft's preview by default; none in a card's picture. */
  notice?: string | null
}) {
  switch (target.kind) {
    case "home":
      return <DraftHome layout={layout} notice={notice} />
    case "shop":
      return <ShopScreen query={queryOf(target.url.searchParams)} />
    case "blog":
      return <BlogIndexScreen query={queryOf(target.url.searchParams)} />
    // The visitor's own cart and the site search with the draft's look (adr/0065 Ek 2026-11-15)
    case "cart":
      return <CartPage searchParams={Promise.resolve(queryOf(target.url.searchParams))} />
    case "search":
      return <SearchScreen query={queryOf(target.url.searchParams)} />
    // A content page by its id, in draft too (the live session only; adr/0073 §5)
    case "content": {
      const draft = await draftContentPage(target.id)
      return draft ? (
        <ContentScreen page={draft.page} entry={draft.entry} />
      ) : (
        <DraftHome layout={layout} notice={notice} />
      )
    }
    case "resolve": {
      const page = await resolvePath(`${target.url.pathname}${target.url.search}`)
      return page.type === "entity" ? (
        <EntityScreen page={page} url={target.url} />
      ) : (
        <DraftHome layout={layout} notice={notice} />
      )
    }
  }
}
