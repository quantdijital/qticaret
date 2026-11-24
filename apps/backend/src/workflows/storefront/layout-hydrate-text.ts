import { NO_CARDS, docStats, renderDoc } from "../../lib/content"
import type { ContentDoc } from "../../lib/content"
import { isFaqHeading } from "../../lib/storefront/sections/faq"
import type { FaqSection } from "../../lib/storefront/sections/faq"
import type { ContactSection } from "../../lib/storefront/sections/page-text"
import type { PageArticle } from "../../lib/storefront/sections/rich-text"
import { fillShopDoc, fillShopText } from "../../lib/shop/tokens"
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

/**
 * The FAQ's rows (adr/0073 Ek 2026-11-24 (2)): a rich answer as the
 * backend's HTML (no cards or pictures: an answer takes none), a plain
 * one saved before rich answers as it printed, its details filled in; a
 * group's heading as written. The variant and the switches printed only
 * off their defaults, so a section from before them prints as it did.
 */
export function hydrateFaq(section: FaqSection, at: Pick<HydrateContext, "values">) {
  return {
    id: section.id,
    type: section.type,
    title: section.title,
    items: section.items.map((row) => {
      if (isFaqHeading(row)) {
        return { heading: row.heading }
      }
      return row.body
        ? { question: row.question, html: renderDoc(fillShopDoc(row.body, at.values), NO_CARDS) }
        : { question: row.question, answer: fillShopText(row.answer ?? "", at.values) }
    }),
    ...(section.variant === "page" ? { variant: section.variant } : {}),
    ...(section.open_first === "on" ? { open_first: "on" } : {}),
    ...(section.single_open === "on" ? { single_open: "on" } : {}),
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
