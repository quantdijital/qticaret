import { packItemKey } from "@qticaret/sector-packs"
import type { SectorPack } from "@qticaret/sector-packs"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { saveContentWorkflow } from "../../workflows/content/workflows"
import { contentDoc } from "../content"
import { isCleanText } from "../security/text"
import type { ApplyContext } from "./context"

/** What is wrong with the pack's pages as the panel's save takes them; none when right. */
export function pageProblems(pack: Pick<SectorPack, "pages">): string[] {
  return (pack.pages ?? []).flatMap((page) => {
    const body = contentDoc.safeParse(page.body)
    return [
      ...(isCleanText(page.title) ? [] : [`page ${page.handle}: text_invalid`]),
      ...(body.success
        ? []
        : body.error.issues.map((issue) => `page ${page.handle} body: ${issue.message}`)),
    ]
  })
}

const pathTaken = (error: unknown): boolean =>
  error instanceof Error && error.message.includes("seo.path_taken")

/**
 * The pack's content pages (adr/0076 §12), each made as a **draft** through
 * the panel's own save workflow (its document checked, its path claimed):
 * the shop reads the template, fills it in and publishes it. A page of the
 * same handle is the shop's, kept; an address another record holds is
 * skipped.
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
      const { result } = await saveContentWorkflow(context.container).run({
        input: {
          kind: "page",
          values: { title: page.title, handle: page.handle, status: "draft", body: page.body },
        },
      })
      made = result.id
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
