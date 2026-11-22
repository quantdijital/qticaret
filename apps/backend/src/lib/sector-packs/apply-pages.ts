import { packItemKey } from "@qticaret/sector-packs"
import type { SectorPack } from "@qticaret/sector-packs"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { importPage } from "../../workflows/migration/content-page"
import { contentDoc, docStats } from "../content"
import { isCleanText } from "../security/text"
import { unknownDocTokens } from "../shop/tokens"
import type { ApplyContext } from "./context"

/**
 * What is wrong with the pack's pages as a page's text is taken when
 * written (`bodyOf`: the document and its `{belirteç}`s), and what only
 * a shop can hold: an image (the shop's own uploads) or a card (its own
 * products and categories) names a record a pack cannot. None when right,
 * so a pack is refused before it writes anything.
 */
export function pageProblems(pack: Pick<SectorPack, "pages">): string[] {
  return (pack.pages ?? []).flatMap((page) => {
    const problems = isCleanText(page.title) ? [] : [`page ${page.handle}: text_invalid`]
    const body = contentDoc.safeParse(page.body)
    if (!body.success) {
      return [
        ...problems,
        ...body.error.issues.map((issue) => `page ${page.handle} body: ${issue.message}`),
      ]
    }
    const stats = docStats(body.data)
    return [
      ...problems,
      ...unknownDocTokens(body.data).map((name) => `page ${page.handle} body: {${name}} unknown`),
      ...(stats.images.length > 0 ? [`page ${page.handle} body: holds an image`] : []),
      ...(stats.cards.product.length + stats.cards.category.length > 0
        ? [`page ${page.handle} body: holds a card`]
        : []),
    ]
  })
}

// A workflow rejects with its error serialized (no Error instance): read by its message
const pathTaken = (error: unknown): boolean => {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === "string" && message.includes("seo.path_taken")
}

/**
 * The pack's content pages (adr/0076 §12), each made as a **draft** the
 * way an import makes a page (adr/0073 Ek 2026-11-19 (2) K4: a page's
 * text is its sections' in the theme editor, never the content save's):
 * the page saved, its text written into the design and its mirror, as one
 * workflow. The shop reads the template, fills it in and publishes it. A
 * page of the same handle is the shop's, kept; an address another record
 * holds is skipped.
 */
export async function applyPages(context: ApplyContext): Promise<void> {
  const content = context.container.resolve<ContentModuleService>(CONTENT_MODULE)
  for (const page of context.pack.pages ?? []) {
    const key = packItemKey.page(page.handle)
    if (context.offered.has(key)) {
      continue
    }
    const [existing] = await content.listContentEntries(
      { kind: "page", handle: page.handle },
      { select: ["id"], take: 1 }
    )
    if (existing) {
      await context.record({ key, kind: "page", outcome: "kept", record_id: existing.id })
      continue
    }
    let made: string | null = null
    try {
      made = await importPage(
        context.container,
        {
          title: page.title,
          handle: page.handle,
          status: "draft",
          excerpt: null,
          author_name: null,
          image_url: null,
          image_alt: null,
        },
        page.body
      )
    } catch (error) {
      if (!pathTaken(error)) {
        throw error
      }
    }
    await context.record({
      key,
      kind: "page",
      outcome: made ? "added" : "skipped",
      record_id: made,
    })
  }
}
