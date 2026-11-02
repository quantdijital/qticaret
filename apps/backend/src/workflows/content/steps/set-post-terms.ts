import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import type { ContentKind, ContentTermKind } from "../../../modules/content/service"
import { planPostTerms, sendsTerms } from "../term-rules"
import type { PostTermsInput, TermRef } from "../term-rules"

export interface SetPostTermsInput {
  entry_id: string
  kind: ContentKind
  terms?: PostTermsInput | undefined
}

interface Link {
  entry_id: string
  term_id: string
  term_kind: ContentTermKind
}

interface Undo {
  /** Rows this save made, and the pairs it took away. */
  created: string[]
  removed: Link[]
}

/**
 * Files a blog post under its category and tags (adr/0019 ek 2026-11-03):
 * at most one category, tags of the shop's; what the save leaves out keeps
 * its value. Undone if a later step fails.
 */
export const setPostTermsStep = createStep(
  "content-set-post-terms",
  async (input: SetPostTermsInput, { container }) => {
    if (!sendsTerms(input.terms)) {
      return new StepResponse<undefined, Undo>(undefined, { created: [], removed: [] })
    }
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const links = await service.listContentEntryTerms(
      { entry_id: input.entry_id },
      { select: ["id", "term_id", "term_kind"], take: null }
    )
    const named = [
      ...(typeof input.terms.category_id === "string" ? [input.terms.category_id] : []),
      ...(input.terms.tag_ids ?? []),
    ]
    const terms = named.length
      ? await service.listContentTerms({ id: [...new Set(named)] }, { select: ["id", "kind"] })
      : []
    const found = new Map<string, TermRef>(terms.map((term) => [term.id, term]))
    const current = links.map((link) => ({ id: link.term_id, kind: link.term_kind }))
    const plan = planPostTerms(input.kind, current, input.terms, found)
    const gone = new Set(plan.remove.map((term) => term.id))
    const removed = links.filter((link) => gone.has(link.term_id))
    if (removed.length > 0) {
      await service.deleteContentEntryTerms(removed.map((link) => link.id))
    }
    const created = plan.add.length
      ? await service.createContentEntryTerms(
          plan.add.map((term) => ({
            entry_id: input.entry_id,
            term_id: term.id,
            term_kind: term.kind,
          }))
        )
      : []
    return new StepResponse<undefined, Undo>(undefined, {
      created: created.map((row) => row.id),
      removed: removed.map((link) => ({
        entry_id: input.entry_id,
        term_id: link.term_id,
        term_kind: link.term_kind,
      })),
    })
  },
  async (undo, { container }) => {
    if (!undo || (undo.created.length === 0 && undo.removed.length === 0)) {
      return
    }
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    if (undo.created.length > 0) {
      await service.deleteContentEntryTerms(undo.created)
    }
    if (undo.removed.length > 0) {
      await service.createContentEntryTerms(undo.removed)
    }
  }
)

/** Takes a deleted entry off its terms; the compensation files it again. */
export const unlinkEntryTermsStep = createStep(
  "content-unlink-entry-terms",
  async (entryId: string, { container }) => {
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const links = await service.listContentEntryTerms(
      { entry_id: entryId },
      { select: ["id", "entry_id", "term_id", "term_kind"], take: null }
    )
    if (links.length > 0) {
      await service.deleteContentEntryTerms(links.map((link) => link.id))
    }
    return new StepResponse<undefined, Link[]>(
      undefined,
      links.map(({ entry_id, term_id, term_kind }) => ({ entry_id, term_id, term_kind }))
    )
  },
  async (links, { container }) => {
    if (links && links.length > 0) {
      await container.resolve<ContentModuleService>(CONTENT_MODULE).createContentEntryTerms(links)
    }
  }
)
