import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { autoSaveDraftStep } from "./design-steps"
import { LAYOUT_LOCK, saveDraftSteps } from "./layout"
import { placePageTextsStep } from "./page-texts-placed"

export interface ReplaceDraftInput {
  /** The design the draft becomes (`draftSource`): a kept revision, what is live or the default. */
  source: LayoutDocument
  /** Where its pages from before their text was a section keep it (adr/0073 Ek 2026-11-19 (2) K6). */
  text_at?: Record<string, number>
  actor: string | null
  reason: "restore" | "discard"
}

/**
 * The draft replaced whole by a revision restored or by what is live
 * (discarded), kept first as an automatic save (adr/0064 Ek 2026-11-17
 * §1.2: nothing replaces the draft unkept). A page from before its text
 * was a section gets today's text where it stood (adr/0073 Ek 2026-11-19
 * (2) K6). Checked and written as the editor's save; any step failing
 * leaves the draft and the saved looks as they were.
 */
export const replaceDraftWorkflow = createWorkflow(
  "storefront-layout-replace-draft",
  (input: ReplaceDraftInput) => {
    acquireLockStep(LAYOUT_LOCK)
    const autoSaved = autoSaveDraftStep(
      transform({ input }, ({ input }) => ({
        actor: input.actor,
        save_as: null,
        reason: input.reason,
      }))
    )
    const source = placePageTextsStep(
      transform({ input }, ({ input }) => ({
        document: input.source,
        text_at: input.text_at ?? {},
      }))
    )
    const saved = saveDraftSteps(
      transform({ source }, ({ source }) => source.document),
      transform({ source }, ({ source }) => source.carried)
    )
    releaseLockStep({ key: LAYOUT_LOCK.key })
    return new WorkflowResponse(
      transform({ autoSaved, saved }, ({ autoSaved, saved }) => ({
        auto_saved: autoSaved,
        // Content pages deleted since that revision, their layouts left out (adr/0073 §1)
        dropped_pages: saved.dropped_pages,
      }))
    )
  }
)
