import { docStats, renderDoc } from "../../lib/content"
import type { ContentDoc } from "../../lib/content"
import type { ContactSection } from "../../lib/storefront/sections/page-text"
import type { PageArticle } from "../../lib/storefront/sections/rich-text"
import { fillShopDoc } from "../../lib/shop/tokens"
import { cardTargets } from "../../api/store/content/cards"
import type { HydrateContext } from "./layout-hydrate"

/**
 * A content page's text as its sections print it (adr/0073 Ek 2026-11-19
 * (2) K2), as `GET /store/content/:id` prints a page: the shop's details
 * in place, the HTML from the checked document with its cards at their
 * records' current paths (a card whose record is gone left out), its
 * library pictures with their sizes and versions, its headings for an
 * outline.
 */
async function printedText(body: ContentDoc, at: HydrateContext) {
  const filled = fillShopDoc(body, at.values)
  const stats = docStats(filled)
  return {
    html: renderDoc(filled, await cardTargets(at.container, filled)),
    images: stats.images.flatMap(({ src }) => {
      const known = at.images.get(src)
      return known
        ? [
            {
              url: known.url,
              width: known.width,
              height: known.height,
              derivatives: known.derivatives,
            },
          ]
        : []
    }),
    headings: stats.headings,
  }
}

/** The page's text as a rich text (`article`): its switches as saved. */
export async function hydrateArticle(section: PageArticle, at: HydrateContext) {
  return {
    id: section.id,
    type: section.type,
    title: section.title,
    variant: section.variant,
    ...(await printedText(section.body, at)),
    outline: section.outline,
    questions: section.questions,
  }
}

/** The contact page's body: its text, the form and the imprint as switched. */
export async function hydrateContact(section: ContactSection, at: HydrateContext) {
  return {
    id: section.id,
    type: section.type,
    ...(await printedText(section.body, at)),
    form: section.form,
    imprint: section.imprint,
  }
}
