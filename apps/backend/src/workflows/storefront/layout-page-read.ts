import type { MedusaContainer } from "@medusajs/framework/types"
import { LAYOUT_LIMITS, isShowing, layoutDocument, sectionIds } from "../../lib/storefront/layout"
import type { ContentPageSection, LayoutDocument } from "../../lib/storefront/layout"
import { hasPageText, pageTextSections, withTextAt } from "../../lib/storefront/page-text"
import { createTtlCache } from "../../lib/cache/ttl-cache"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { linksOf } from "./layout-check"
import { hydrateContext } from "./layout-context"
import { hydrateSection } from "./layout-hydrate"
import { liveRecords } from "./layout-live"
import { imageUrls } from "./layout-read"
import { publishedRead } from "./layout-published"
import { editionKey, layoutEdition } from "./layout-row"
import { pageTextSources } from "./page-text-source"

/** A design as a page's read takes it: the document, and where older pages' text stands. */
export interface PageDesign {
  document: LayoutDocument
  /** `legacyTextAt` of the stored document (adr/0073 Ek 2026-11-19 (2) K1). */
  text_at: Readonly<Record<string, number>>
}

/**
 * A content page's sections in the design (Ek 2026-11-19 (2) K1): its
 * entry's, the page's text placed where an older entry kept it (before
 * the conversion put it there, K3); none, its text made into sections as
 * the conversion would (`synthesized`). A page with neither text nor a
 * role and no entry has no sections.
 */
async function pageSectionsIn(
  container: MedusaContainer,
  design: PageDesign,
  pageId: string
): Promise<{ sections: ContentPageSection[]; synthesized: boolean }> {
  const page = design.document.pages.find((each) => each.page_id === pageId)
  const at = design.text_at[pageId]
  if (page && (at === undefined || hasPageText(page.sections))) {
    return { sections: page.sections, synthesized: false }
  }
  const source = (await pageTextSources(container, [pageId])).get(pageId)
  const texts = source ? pageTextSections(source, sectionIds(design.document)) : []
  if (!page) {
    return { sections: texts, synthesized: true }
  }
  const placed = withTextAt(page.sections, texts, at ?? 0, LAYOUT_LIMITS.page)
  return { sections: placed.sections, synthesized: false }
}

/**
 * A content page's own layout as the storefront shows it at a moment
 * (adr/0073 §6, Ek 2026-11-19 (2)): its sections showing then, in their
 * order, read as the home page's are (only live records, links placed,
 * images sized, rich text as HTML, the page's text as the page printed
 * it, the shop's details in place, a sale or best-seller rail's products
 * picked for the shopper's sales channels). A page the design has no
 * entry for is answered with its text as sections, `synthesized`. Asked
 * per page, so the whole design's answer does not carry every page's.
 */
export async function storePageLayout(
  container: MedusaContainer,
  design: PageDesign,
  pageId: string,
  channels: readonly string[] | null = null,
  now = new Date()
) {
  const { sections: all, synthesized } = await pageSectionsIn(container, design, pageId)
  const showing = all.filter((section) => isShowing(section, now))
  const head = { page_id: pageId, ...(synthesized ? { synthesized: true as const } : {}) }
  if (showing.length === 0) {
    return { ...head, sections: [] }
  }
  const keepLive = await liveRecords(container, showing)
  const sections = keepLive(showing)
  const at = await hydrateContext(container, {
    links: sections.flatMap(linksOf),
    urls: sections.flatMap(imageUrls),
    picked: sections,
    channels,
    live: keepLive.live,
  })
  return {
    ...head,
    sections: await Promise.all(sections.map((section) => hydrateSection(section, at))),
  }
}

export type ShownPage = Awaited<ReturnType<typeof storePageLayout>> | null

/** A content page as the layout's reads see it: a page (never a post), and whether it is live. */
export async function contentPageOf(
  container: MedusaContainer,
  id: string
): Promise<{ id: string; live: boolean } | null> {
  const [entry] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentEntries({ id, kind: "page" }, { select: ["id", "status"], take: 1 })
  return entry ? { id: entry.id, live: entry.status === "published" } : null
}

// A live page's layout, hydrated once a minute per process at most (as the whole
// design's, security review 2026-11-02 L2): keyed by the revision, the page and the
// publishable key's sales channels (the shop's keys, never the visitor's words). Only
// a live page takes an entry (the route asks only for one, security review 2026-11-19,
// I1): fifty at most since every page answers (K1), a few sales channel sets each. A
// synthesized page's text written since (an import) is seen within the minute
const pageCache = createTtlCache<ShownPage>({ ttlMs: 60_000, maxEntries: 100 })

/**
 * A live content page's layout as published, shown now in these sales
 * channels; a new publication is seen at once. None published yet (the
 * default design lays out no page): the page's text as sections. The
 * revision is looked up alone; the published design is parsed once per
 * revision (`publishedRead`), each page read from it.
 */
export async function publishedPageLayout(
  container: MedusaContainer,
  pageId: string,
  channels: readonly string[] | null = null
): Promise<ShownPage> {
  const edition = await layoutEdition(container)
  const shop = channels ? [...new Set(channels)].sort().join(",") : "*"
  const key = `${edition?.published ? editionKey(edition) : "unpublished"}|${pageId}|${shop}`
  return pageCache(key, async () => {
    const design = edition?.published ? await publishedRead(container, edition) : NO_DESIGN
    return storePageLayout(container, design, pageId, channels)
  })
}

/** The design before any is published: no page has an entry. */
const NO_DESIGN: PageDesign = { document: layoutDocument.parse({}), text_at: {} }
