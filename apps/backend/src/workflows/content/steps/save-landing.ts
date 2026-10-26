import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import type { LandingPageRecord } from "../../../modules/content/service"
import { landingPlan } from "../landing-rules"
import type { LandingFields, LandingInput } from "../landing-rules"

export interface SaveLandingInput {
  /** The page to change; none makes a new one. */
  id?: string | undefined
  values: LandingInput
}

export type SavedLanding = LandingFields & { id: string; was_live: boolean }

type Undo = { created: string } | { id: string; previous: LandingFields }

const fieldsOf = (row: LandingPageRecord): LandingFields => ({
  category_id: row.category_id,
  facet_kind: row.facet_kind,
  facet_key: row.facet_key,
  facet_value: row.facet_value,
  title: row.title,
  handle: row.handle,
  status: row.status,
  body: row.body as unknown as LandingFields["body"],
  body_summary: row.body_summary,
  word_count: row.word_count,
  fingerprint_size: row.fingerprint_size,
  fingerprint: row.fingerprint as unknown as number[],
  originality: row.originality,
  text_live_at: row.text_live_at,
  reviewed_at: row.reviewed_at,
  published_at: row.published_at,
  revised_at: row.revised_at,
})

const stored = (fields: LandingFields) => ({
  ...fields,
  body: fields.body as unknown as Record<string, unknown>,
  fingerprint: fields.fingerprint as unknown as Record<string, unknown>,
})

/** Checks and writes a landing page; undone if a later step fails (its path, its media). */
export const saveLandingStep = createStep(
  "content-write-landing",
  async (input: SaveLandingInput, { container }) => {
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const current = input.id
      ? ((await service.listLandingPages({ id: input.id }, { take: 1 }))[0] ?? null)
      : null
    if (input.id && !current) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.landing_unknown")
    }
    const { fields, media, wasLive } = await landingPlan(container, input.values, current)
    if (!current) {
      const created = await service.createLandingPages(stored(fields))
      return new StepResponse<{ saved: SavedLanding; media: string[] }, Undo>(
        { saved: { id: created.id, ...fields, was_live: wasLive }, media },
        { created: created.id }
      )
    }
    await service.updateLandingPages({ id: current.id, ...stored(fields) })
    return new StepResponse<{ saved: SavedLanding; media: string[] }, Undo>(
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
      await service.deleteLandingPages(undo.created)
      return
    }
    await service.updateLandingPages({ id: undo.id, ...stored(undo.previous) })
  }
)
