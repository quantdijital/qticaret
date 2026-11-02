import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import type { ContentTermKind, ContentTermRecord } from "../../../modules/content/service"
import { termPlan } from "../term-plan"
import type { TermFields, TermInput } from "../term-plan"
import { postCounts } from "../term-reads"

export interface SaveTermInput {
  /** The term to change; none makes a new one of `kind`. */
  id?: string | undefined
  kind?: ContentTermKind | undefined
  values: TermInput
}

/** The term as written; `was_live` says whether its archive had live posts (its old path's fate). */
export type SavedTerm = TermFields & { id: string; was_live: boolean }

type Undo = { created: string } | { id: string; previous: TermFields }

const fieldsOf = (term: ContentTermRecord): TermFields => ({
  kind: term.kind,
  name: term.name,
  handle: term.handle,
  description: term.description,
  rank: term.rank,
})

/** Checks and writes a blog category or tag; undone if a later step fails (its path). */
export const saveTermStep = createStep(
  "content-write-term",
  async (input: SaveTermInput, { container }) => {
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const current = input.id
      ? ((await service.listContentTerms({ id: input.id }, { take: 1 }))[0] ?? null)
      : null
    if (input.id && !current) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.term_unknown")
    }
    const kind = current?.kind ?? input.kind ?? "category"
    const fields = await termPlan(container, kind, input.values, current)
    if (!current) {
      const created = await service.createContentTerms(fields)
      return new StepResponse<SavedTerm, Undo>(
        { id: created.id, ...fields, was_live: false },
        { created: created.id }
      )
    }
    const live = await postCounts(container, [current.id], { live: true })
    await service.updateContentTerms({ id: current.id, ...fields })
    return new StepResponse<SavedTerm, Undo>(
      { id: current.id, ...fields, was_live: (live.get(current.id) ?? 0) > 0 },
      { id: current.id, previous: fieldsOf(current) }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    if ("created" in undo) {
      await service.deleteContentTerms(undo.created)
      return
    }
    await service.updateContentTerms({ id: undo.id, ...undo.previous })
  }
)
