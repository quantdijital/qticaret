import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import type { ContentTermKind } from "../../../modules/content/service"
import { postCounts } from "../term-reads"

export interface DeletedTerm {
  id: string
  kind: ContentTermKind
  /** Posts it was taken off: a category's become uncategorised, a tag's lose the tag. */
  unlinked: number
  /** It had live posts: its archive was public, so its path answers 410 (adr/0017). */
  was_live: boolean
}

interface Undo {
  id: string
  links: { entry_id: string; term_id: string; term_kind: ContentTermKind }[]
}

/**
 * Soft-deletes a blog category or tag and takes it off its posts, never
 * refused for having them. The compensation brings both back.
 */
export const deleteTermStep = createStep(
  "content-remove-term",
  async (id: string, { container }) => {
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const [term] = await service.listContentTerms({ id }, { take: 1, select: ["id", "kind"] })
    if (!term) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.term_unknown")
    }
    const live = await postCounts(container, [id], { live: true })
    const links = await service.listContentEntryTerms(
      { term_id: id },
      { select: ["id", "entry_id", "term_id", "term_kind"], take: null }
    )
    if (links.length > 0) {
      await service.deleteContentEntryTerms(links.map((link) => link.id))
    }
    await service.softDeleteContentTerms([id])
    return new StepResponse<DeletedTerm, Undo>(
      { id, kind: term.kind, unlinked: links.length, was_live: (live.get(id) ?? 0) > 0 },
      {
        id,
        links: links.map(({ entry_id, term_id, term_kind }) => ({ entry_id, term_id, term_kind })),
      }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    await service.restoreContentTerms([undo.id])
    if (undo.links.length > 0) {
      await service.createContentEntryTerms(undo.links)
    }
  }
)
