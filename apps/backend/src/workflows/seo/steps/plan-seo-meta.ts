import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { publicUploadUrl } from "../../files/public-upload"
import { ValidationError } from "../../../lib/errors"
import { seoTextHash } from "../../../lib/seo"
import { SEO_ENTITIES, seoEntityFilter } from "../entities"
import type { SeoEntityType, SeoValues } from "../entities"

export interface UpsertSeoMetaInput {
  entity_type: SeoEntityType
  entity_id: string
  /** Fields left out (or undefined) keep their values; null clears one. */
  values: { [K in keyof SeoValues]?: SeoValues[K] | undefined }
}

type Stored = SeoValues & { id: string; title_hash: string | null; description_hash: string | null }

export interface SeoMetaPlan {
  entity_type: SeoEntityType
  entity_id: string
  /** The row to update; null: one is made and linked. */
  id: string | null
  set: Partial<Stored>
  previous: Partial<Stored>
  /** Other pages of the same type with the same title or description (a warning, not a refusal). */
  duplicates: { seo_title: number; seo_description: number }
}

const EMPTY: SeoValues = {
  seo_title: null,
  seo_description: null,
  focus_keyword: null,
  canonical_override: null,
  robots_override: null,
  og_image_override: null,
  og_image_alt: null,
}

async function current(
  container: MedusaContainer,
  type: SeoEntityType,
  id: string
): Promise<Stored | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: SEO_ENTITIES[type].entity,
    fields: ["id", "seo_meta.*"],
    filters: seoEntityFilter(type, id),
  })
  const row = data[0] as { id: string; seo_meta?: Stored | null } | undefined
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "seo.entity_unknown")
  }
  return row.seo_meta ?? null
}

async function countSame(
  container: MedusaContainer,
  type: SeoEntityType,
  field: "title_hash" | "description_hash",
  hash: string | null,
  ownId: string | null
): Promise<number> {
  if (!hash) {
    return 0
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seo_meta",
    fields: ["id"],
    filters: { entity_type: type, [field]: hash },
  })
  return (data as { id: string }[]).filter((row) => row.id !== ownId).length
}

/** The OG image must be one of the shop's own uploads, never a job's private result (adr/0015). */
async function assertOwnFile(container: MedusaContainer, fileId: string): Promise<void> {
  if ((await publicUploadUrl(container, fileId)) === null) {
    throw new ValidationError("seo.og_image_unknown", { field: "og_image_override" })
  }
}

/** Checks a page's SEO save and works out what to write; writes nothing. */
export const planSeoMetaStep = createStep(
  "seo-plan-seo-meta",
  async (input: UpsertSeoMetaInput, { container }) => {
    const stored = await current(container, input.entity_type, input.entity_id)
    // Only the fields the body names change (absent keeps, null clears)
    const changed = Object.fromEntries(
      Object.entries(input.values).filter(([, value]) => value !== undefined)
    ) as Partial<SeoValues>
    if (changed.og_image_override) {
      await assertOwnFile(container, changed.og_image_override)
    }
    const merged = { ...EMPTY, ...(stored ?? {}), ...changed }
    const hashes = {
      title_hash: seoTextHash(merged.seo_title),
      description_hash: seoTextHash(merged.seo_description),
    }
    const set: Partial<Stored> = { ...changed, ...hashes }
    const previous: Partial<Stored> = stored
      ? Object.fromEntries(
          Object.keys(set).map((key) => [key, stored[key as keyof Stored] ?? null])
        )
      : {}
    const ownId = stored?.id ?? null
    const plan: SeoMetaPlan = {
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      id: ownId,
      set,
      previous,
      duplicates: {
        seo_title: await countSame(
          container,
          input.entity_type,
          "title_hash",
          hashes.title_hash,
          ownId
        ),
        seo_description: await countSame(
          container,
          input.entity_type,
          "description_hash",
          hashes.description_hash,
          ownId
        ),
      },
    }
    return new StepResponse(plan)
  }
)
