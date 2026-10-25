import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { SEO_META_MODULE } from "../../../modules/seo-meta"
import type SeoMetaModuleService from "../../../modules/seo-meta/service"
import type { SeoMetaPlan } from "./plan-seo-meta"

type Undo =
  | { kind: "created"; id: string }
  | { kind: "updated"; id: string; previous: SeoMetaPlan["previous"] }

interface Written {
  id: string
  /** A new row, to be linked to its page. */
  created: boolean
}

/** Updates the page's row or makes one; undoes either if a later step fails. */
export const writeSeoMetaStep = createStep(
  "seo-write-seo-meta",
  async (plan: SeoMetaPlan, { container }) => {
    const service = container.resolve<SeoMetaModuleService>(SEO_META_MODULE)
    if (plan.id) {
      await service.updateSeoMetas({ id: plan.id, ...plan.set })
      const undo: Undo = { kind: "updated", id: plan.id, previous: plan.previous }
      return new StepResponse<Written, Undo>({ id: plan.id, created: false }, undo)
    }
    const created = await service.createSeoMetas({ entity_type: plan.entity_type, ...plan.set })
    const undo: Undo = { kind: "created", id: created.id }
    return new StepResponse<Written, Undo>({ id: created.id, created: true }, undo)
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<SeoMetaModuleService>(SEO_META_MODULE)
    if (undo.kind === "created") {
      await service.deleteSeoMetas(undo.id)
    } else {
      await service.updateSeoMetas({ id: undo.id, ...undo.previous })
    }
  }
)
