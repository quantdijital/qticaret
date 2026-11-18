import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { IMAGE_ALT_TEXT_TASK } from "../../../../lib/ai/registry/tasks"
import { CONTENT_DRAFTS_MODULE } from "../../../../modules/content-drafts"
import type ContentDraftsModuleService from "../../../../modules/content-drafts/service"
import { MEDIA_MODULE } from "../../../../modules/media"
import type MediaModuleService from "../../../../modules/media/service"
import { STAFF_ROLES_MODULE } from "../../../../modules/staff-roles"
import type StaffRolesModuleService from "../../../../modules/staff-roles/service"
import { AI_SUGGESTION_SOURCE } from "../../../../workflows/ai/steps/save-suggestion"
import { displayName } from "../../../../lib/media"

/** How many open suggestions one read returns: two bulk jobs' worth. */
export const OPEN_SUGGESTIONS_MAX = 100

export interface OpenAltSuggestion {
  id: string
  service: string
  text: string
  created_at: Date
  /** The image it is for, as the library shows it; its alt text as it is now. */
  media: { id: string; url: string; filename: string; alt: string | null }
}

/**
 * The image alt text suggestions still waiting for a decision (docs/22
 * "Aşama 5", the panel's review list): the newest one per image, only for
 * images that still exist. Read by the roles the task allows, as asking
 * and deciding are (adr/0071 §6). Nothing is written.
 */
export async function readOpenAltSuggestions(
  container: Pick<MedusaContainer, "resolve">,
  userId: string
): Promise<OpenAltSuggestion[]> {
  const role = await container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).roleOf(userId)
  if (role === null || !IMAGE_ALT_TEXT_TASK.roles.includes(role)) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "staff.forbidden")
  }
  const drafts = await container
    .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
    .listContentDrafts(
      {
        kind: IMAGE_ALT_TEXT_TASK.id,
        entity_type: "media",
        source: AI_SUGGESTION_SOURCE,
        status: "draft",
      },
      {
        select: ["id", "entity_id", "text", "provider", "created_at"],
        order: { created_at: "DESC", id: "DESC" },
        take: OPEN_SUGGESTIONS_MAX,
      }
    )
  // The newest per image: an older one for the same image is left as it is
  const newest = new Map<string, (typeof drafts)[number]>()
  for (const draft of drafts) {
    if (!newest.has(draft.entity_id)) {
      newest.set(draft.entity_id, draft)
    }
  }
  if (newest.size === 0) {
    return []
  }
  const assets = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets(
      { id: [...newest.keys()] },
      { select: ["id", "url", "file_id", "filename", "alt"] }
    )
  const byId = new Map(assets.map((asset) => [asset.id, asset]))
  return [...newest.values()].flatMap((draft) => {
    const asset = byId.get(draft.entity_id)
    if (!asset) {
      return []
    }
    return [
      {
        id: draft.id,
        service: draft.provider,
        text: draft.text,
        created_at: draft.created_at,
        media: {
          id: asset.id,
          url: asset.url,
          filename: asset.filename ?? displayName(asset.file_id ?? asset.url),
          alt: asset.alt,
        },
      },
    ]
  })
}
