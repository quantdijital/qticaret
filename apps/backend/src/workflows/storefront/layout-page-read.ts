import type { MedusaContainer } from "@medusajs/framework/types"
import { isShowing } from "../../lib/storefront/layout"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { createTtlCache } from "../../lib/cache/ttl-cache"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { linksOf } from "./layout-check"
import { hydrateContext } from "./layout-context"
import { hydrateSection } from "./layout-hydrate"
import { liveRecords } from "./layout-live"
import { imageUrls } from "./layout-read"
import { publishedDocument } from "./layout-published"
import { editionKey, layoutEdition } from "./layout-row"

/**
 * A content page's own layout as the storefront shows it at a moment
 * (adr/0073 §6): only its sections showing then, each in its place (above
 * the page's text or below it), read as the home page's are (only live
 * records, links placed, images sized, rich text as HTML, the shop's
 * details in place, a sale or best-seller rail's products picked for the
 * shopper's sales channels). A page the design gives no layout: null, the
 * page drawn as before. Asked per page, so the whole design's answer does
 * not carry every page's.
 */
export async function storePageLayout(
  container: MedusaContainer,
  doc: LayoutDocument,
  pageId: string,
  channels: readonly string[] | null = null,
  now = new Date()
) {
  const page = doc.pages.find((each) => each.page_id === pageId)
  if (!page) {
    return null
  }
  const showing = page.sections.filter((section) => isShowing(section, now))
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
    page_id: page.page_id,
    sections: await Promise.all(
      sections.map(async (section) => ({
        ...(await hydrateSection(section, at)),
        placement: section.placement,
      }))
    ),
  }
}

export type ShownPage = Awaited<ReturnType<typeof storePageLayout>>

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
// a page the design lays out takes an entry (security review 2026-11-19, I1): twenty
// at most, a few sales channel sets each
const pageCache = createTtlCache<ShownPage>({ ttlMs: 60_000, maxEntries: 40 })

/**
 * A live content page's layout as published, shown now in these sales
 * channels; a new publication is seen at once. None published yet (the
 * default design has no page layouts) or a page with none: null. The
 * revision is looked up alone; the published design is parsed once per
 * revision (`publishedDocument`), each page read from it.
 */
export async function publishedPageLayout(
  container: MedusaContainer,
  pageId: string,
  channels: readonly string[] | null = null
): Promise<ShownPage> {
  const edition = await layoutEdition(container)
  if (!edition?.published) {
    return null
  }
  const doc = await publishedDocument(container, edition)
  if (!doc.pages.some((page) => page.page_id === pageId)) {
    return null
  }
  const shop = channels ? [...new Set(channels)].sort().join(",") : "*"
  const key = `${editionKey(edition)}|${pageId}|${shop}`
  return pageCache(key, () => storePageLayout(container, doc, pageId, channels))
}
