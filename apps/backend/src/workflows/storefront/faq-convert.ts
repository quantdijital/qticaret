import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { acquireLocksStep } from "../locking/acquire-locks"
import { releaseLocksStep } from "../locking/release-locks"
import { logger } from "../../lib/logging"
import { convertFaqPages } from "../../lib/storefront/faq-convert"
import type { FaqConversionCount } from "../../lib/storefront/faq-convert"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"
import type AuditLogModuleService from "../../modules/audit-log/service"
import { LAYOUT_LOCK } from "./layout"
import { layoutRow } from "./layout-row"
import { undoSystemLayout, writeSystemLayout } from "./layout-system"
import { refreshStorefrontStep } from "./steps/refresh-storefront"

/** What a conversion did: the draft's counts, and whether the live design changed (a new revision). */
export interface FaqPagesConverted extends FaqConversionCount {
  live: boolean
}

const NOTHING: FaqPagesConverted = { converted: 0, left: 0, live: false }

/**
 * The questions texts turned into FAQs in the draft and, when one is
 * live, the live design (a new revision by the system, as the page texts'
 * own conversion, adr/0073 Ek 2026-11-19 (2) K3), so the live page draws
 * the same at once; written only when something turned, so a second run
 * writes nothing. Undone, the design is as it was.
 */
const convertFaqPagesStep = createStep(
  "storefront-convert-faq-pages",
  async (_: undefined, { container }) => {
    const row = await layoutRow(container)
    if (!row) {
      return new StepResponse(NOTHING, null)
    }
    const draft = convertFaqPages(row.draft as Record<string, unknown>)
    const live = row.published ? convertFaqPages(row.published as Record<string, unknown>) : null
    const draftMoved = draft.document !== row.draft
    const liveMoved = live !== null && live.document !== row.published
    if (!draftMoved && !liveMoved) {
      return new StepResponse({ ...draft.count, live: false }, null)
    }
    const undo = await writeSystemLayout(container, row, {
      draft: draft.document,
      published: liveMoved ? live.document : null,
    })
    try {
      await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
        kind: "system",
        action: "storefront.faq_pages_converted",
        actor_type: "system",
        resource_type: "storefront_layout",
        resource_id: row.id,
        // Counts only: never a page's text
        changes: { converted: draft.count.converted, left: draft.count.left, live: liveMoved },
      })
    } catch (error) {
      // The step did not finish, so the workflow will not undo it: put the design back
      await undoSystemLayout(container, undo)
      throw error
    }
    return new StepResponse({ ...draft.count, live: undo.made !== null }, undo)
  },
  async (undo, { container }) => {
    if (undo) {
      await undoSystemLayout(container, undo)
    }
  }
)

/** The conversion under the design's lock, the storefront told after. */
export const convertFaqPagesWorkflow = createWorkflow("storefront-convert-faq-pages", () => {
  const held = acquireLocksStep(LAYOUT_LOCK)
  const converted = convertFaqPagesStep()
  releaseLocksStep(held)
  refreshStorefrontStep(["layout"])
  return new WorkflowResponse(converted)
})

/**
 * The content pages drawn as questions out of their text turned into FAQ
 * sections, once (adr/0073 Ek 2026-11-24 (2); run by the `db:migrate`
 * script `migration-scripts/faq-pages-into-sections.ts`). Logged with
 * counts only.
 */
export async function convertFaqTexts(container: MedusaContainer): Promise<FaqPagesConverted> {
  const { result } = await convertFaqPagesWorkflow(container).run()
  logger.info({
    event: "storefront.faq_pages_converted",
    converted: result.converted,
    left: result.left,
    live: result.live,
  })
  return result
}
