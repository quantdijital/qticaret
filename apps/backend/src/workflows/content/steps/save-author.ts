import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import type { ContentAuthorRecord } from "../../../modules/content/service"
import { authorPlan } from "../author-plan"
import type { AuthorFields, AuthorInput } from "../author-plan"
import { authorPostCounts } from "../author-reads"

export interface SaveAuthorInput {
  /** The author to change; none makes a new one. */
  id?: string | undefined
  values: AuthorInput
}

/** The author as written; `was_live` says whether their page had live posts (its old path's fate). */
export type SavedAuthor = AuthorFields & { id: string; was_live: boolean }

type Undo = { created: string } | { id: string; previous: AuthorFields }

const fieldsOf = (author: ContentAuthorRecord): AuthorFields => ({
  name: author.name,
  handle: author.handle,
  job_title: author.job_title,
  bio: author.bio,
  image_url: author.image_url,
  website_url: author.website_url,
  linkedin_url: author.linkedin_url,
  instagram_url: author.instagram_url,
  x_url: author.x_url,
  user_id: author.user_id,
})

/** Checks and writes a blog author; undone if a later step fails (their path, their photo). */
export const saveAuthorStep = createStep(
  "content-write-author",
  async (input: SaveAuthorInput, { container }) => {
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const current = input.id
      ? ((await service.listContentAuthors({ id: input.id }, { take: 1 }))[0] ?? null)
      : null
    if (input.id && !current) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.author_unknown")
    }
    const { fields, media } = await authorPlan(container, input.values, current)
    if (!current) {
      const created = await service.createContentAuthors(fields)
      return new StepResponse<{ saved: SavedAuthor; media: string[] }, Undo>(
        { saved: { id: created.id, ...fields, was_live: false }, media },
        { created: created.id }
      )
    }
    const live = await authorPostCounts(container, [current.id], { live: true })
    await service.updateContentAuthors({ id: current.id, ...fields })
    return new StepResponse<{ saved: SavedAuthor; media: string[] }, Undo>(
      { saved: { id: current.id, ...fields, was_live: (live.get(current.id) ?? 0) > 0 }, media },
      { id: current.id, previous: fieldsOf(current) }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    if ("created" in undo) {
      await service.deleteContentAuthors(undo.created)
      return
    }
    await service.updateContentAuthors({ id: undo.id, ...undo.previous })
  }
)
