import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { draftCandidates } from "../../../lib/ai/draft-candidates"
import { SEO_TITLE_TASK, findAiTask } from "../../../lib/ai/registry/tasks"
import { CONTENT_DRAFTS_MODULE } from "../../../modules/content-drafts"
import type ContentDraftsModuleService from "../../../modules/content-drafts/service"
import { STAFF_ROLES_MODULE } from "../../../modules/staff-roles"
import type StaffRolesModuleService from "../../../modules/staff-roles/service"
import { SEO_ENTITIES, isSeoEntityType } from "../../seo/entities"
import type { SeoEntityType } from "../../seo/entities"
import { AI_SUGGESTION_SOURCE } from "../steps/save-suggestion"
import { SEO_FILL_TASK_IDS } from "./read"

/** How many open suggestions one read returns: two full jobs' worth. */
export const OPEN_SEO_SUGGESTIONS_MAX = 200

export interface OpenSeoSuggestion {
  id: string
  task: string
  service: string
  /** The candidates offered, in order; the one taken is accepted by its place. */
  candidates: string[]
  created_at: Date
  /** The page it is for: its name as the panel lists it and the field's own text now. */
  entity: { type: string; id: string; name: string; current: string | null }
}

// Each kind's name column; a kind not here has no review row
const NAME_FIELD: Readonly<Partial<Record<SeoEntityType, string>>> = {
  product: "title",
  category: "name",
  collection: "title",
  brand: "name",
  page: "title",
  post: "title",
}

type Container = Pick<MedusaContainer, "resolve">

interface Page {
  name: string
  seo_title: string | null
  seo_description: string | null
}

async function pagesOf(
  container: Container,
  type: SeoEntityType,
  ids: string[]
): Promise<Map<string, Page>> {
  const nameField = NAME_FIELD[type]
  if (!nameField) {
    return new Map()
  }
  const spec = SEO_ENTITIES[type]
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: spec.entity,
    fields: ["id", nameField, "seo_meta.seo_title", "seo_meta.seo_description"],
    filters: { id: ids, ...("kind" in spec ? { kind: spec.kind } : {}) },
  })
  const rows = data as (Record<string, unknown> & {
    id: string
    seo_meta?: { seo_title?: string | null; seo_description?: string | null } | null
  })[]
  return new Map(
    rows.map((row) => {
      const name = row[nameField]
      return [
        row.id,
        {
          name: typeof name === "string" && name !== "" ? name : row.id,
          seo_title: row.seo_meta?.seo_title ?? null,
          seo_description: row.seo_meta?.seo_description ?? null,
        },
      ] as const
    })
  )
}

/**
 * The search text suggestions still waiting for a decision (adr/0074 §5
 * madde 7, the SEO fill's review dialog): the newest per page and task,
 * only for pages that still exist, with the page's name and the field's
 * text now. Read by the roles the task allows. Nothing is written.
 */
export async function readOpenSeoSuggestions(
  container: Container,
  userId: string
): Promise<OpenSeoSuggestion[]> {
  const role = await container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).roleOf(userId)
  if (role === null || !SEO_TITLE_TASK.roles.includes(role)) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "staff.forbidden")
  }
  const drafts = await container
    .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
    .listContentDrafts(
      { kind: [...SEO_FILL_TASK_IDS], source: AI_SUGGESTION_SOURCE, status: "draft" },
      {
        select: ["id", "kind", "entity_type", "entity_id", "text", "provider", "created_at"],
        order: { created_at: "DESC", id: "DESC" },
        take: OPEN_SEO_SUGGESTIONS_MAX,
      }
    )
  // The newest per page and task: an older one is left as it is
  const newest = new Map<string, (typeof drafts)[number]>()
  for (const draft of drafts) {
    const key = `${draft.entity_type}:${draft.entity_id}:${draft.kind}`
    if (!newest.has(key) && isSeoEntityType(draft.entity_type)) {
      newest.set(key, draft)
    }
  }
  const idsByType = new Map<SeoEntityType, string[]>()
  for (const draft of newest.values()) {
    const type = draft.entity_type as SeoEntityType
    idsByType.set(type, [...(idsByType.get(type) ?? []), draft.entity_id])
  }
  const pages = new Map<string, Page>()
  for (const [type, ids] of idsByType) {
    for (const [id, page] of await pagesOf(container, type, [...new Set(ids)])) {
      pages.set(`${type}:${id}`, page)
    }
  }
  return [...newest.values()].flatMap((draft) => {
    const page = pages.get(`${draft.entity_type}:${draft.entity_id}`)
    const candidates = draftCandidates(findAiTask(draft.kind), draft.text)
    if (!page || candidates.length === 0) {
      return []
    }
    return [
      {
        id: draft.id,
        task: draft.kind,
        service: draft.provider,
        candidates,
        created_at: draft.created_at,
        entity: {
          type: draft.entity_type,
          id: draft.entity_id,
          name: page.name,
          current: draft.kind === "seo_title" ? page.seo_title : page.seo_description,
        },
      },
    ]
  })
}
