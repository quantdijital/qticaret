import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import { authorPostCounts } from "../author-reads"

export interface DeletedAuthor {
  id: string
  /** Posts that named them: they are left without an author (their old text, if any, shows). */
  unlinked: number
  /** They had live posts: their page was public, so its path answers 410 (adr/0017). */
  was_live: boolean
}

interface Undo {
  id: string
  posts: string[]
}

/**
 * Soft-deletes a blog author and takes them off their posts, never refused
 * for having them. The compensation brings both back.
 */
export const deleteAuthorStep = createStep(
  "content-remove-author",
  async (id: string, { container }) => {
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const [author] = await service.listContentAuthors({ id }, { take: 1, select: ["id"] })
    if (!author) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.author_unknown")
    }
    const live = await authorPostCounts(container, [id], { live: true })
    const posts = await service.listContentEntries(
      { author_id: id },
      { select: ["id"], take: null }
    )
    if (posts.length > 0) {
      await service.updateContentEntries(posts.map((post) => ({ id: post.id, author_id: null })))
    }
    await service.softDeleteContentAuthors([id])
    return new StepResponse<DeletedAuthor, Undo>(
      { id, unlinked: posts.length, was_live: (live.get(id) ?? 0) > 0 },
      { id, posts: posts.map((post) => post.id) }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    await service.restoreContentAuthors([undo.id])
    if (undo.posts.length > 0) {
      await service.updateContentEntries(undo.posts.map((id) => ({ id, author_id: undo.id })))
    }
  }
)
