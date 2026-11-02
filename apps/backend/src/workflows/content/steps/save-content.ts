import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import type { ContentEntryRecord, ContentKind } from "../../../modules/content/service"
import { contentPlan } from "../rules"
import type { ContentFields, ContentInput } from "../rules"
import type { PostTermsInput } from "../term-rules"

export interface SaveContentInput {
  /** The entry to change; none makes a new one of `kind`. */
  id?: string | undefined
  kind?: ContentKind | undefined
  values: ContentInput
  /** A post's category and tags (adr/0019 ek 2026-11-03); left out, they stay. */
  terms?: PostTermsInput | undefined
}

/** The entry as written; `was_live` says whether it had been live before (its old path's fate). */
export type SavedContent = ContentFields & { id: string; was_live: boolean }

type Undo = { created: string } | { id: string; previous: ContentFields }

const fieldsOf = (entry: ContentEntryRecord): ContentFields => ({
  kind: entry.kind,
  title: entry.title,
  handle: entry.handle,
  status: entry.status,
  body: entry.body as unknown as ContentFields["body"],
  body_summary: entry.body_summary,
  word_count: entry.word_count,
  excerpt: entry.excerpt,
  author_name: entry.author_name,
  image_url: entry.image_url,
  image_alt: entry.image_alt,
  published_at: entry.published_at,
  revised_at: entry.revised_at,
})

/** Checks and writes a content entry; undone if a later step fails (its path, its media). */
export const saveContentStep = createStep(
  "content-write-entry",
  async (input: SaveContentInput, { container }) => {
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const current = input.id
      ? ((await service.listContentEntries({ id: input.id }, { take: 1 }))[0] ?? null)
      : null
    if (input.id && !current) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.unknown")
    }
    const kind = current?.kind ?? input.kind ?? "page"
    const { fields, media, wasLive } = await contentPlan(container, kind, input.values, current)
    const write = { ...fields, body: fields.body as unknown as Record<string, unknown> }
    if (!current) {
      const created = await service.createContentEntries(write)
      return new StepResponse<{ saved: SavedContent; media: string[] }, Undo>(
        { saved: { id: created.id, ...fields, was_live: wasLive }, media },
        { created: created.id }
      )
    }
    await service.updateContentEntries({ id: current.id, ...write })
    return new StepResponse<{ saved: SavedContent; media: string[] }, Undo>(
      { saved: { id: current.id, ...fields, was_live: wasLive }, media },
      { id: current.id, previous: fieldsOf(current) }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    if ("created" in undo) {
      await service.deleteContentEntries(undo.created)
      return
    }
    await service.updateContentEntries({
      id: undo.id,
      ...undo.previous,
      body: undo.previous.body as unknown as Record<string, unknown>,
    })
  }
)
