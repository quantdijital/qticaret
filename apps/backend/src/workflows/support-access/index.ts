import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import type { SupportEndReason, SupportSession } from "../../lib/support-access/store"
import {
  endSupportSessionStep,
  notifyOwnersStep,
  openSupportSessionStep,
  recordSupportStartStep,
} from "./steps"
import type { RequestFacts } from "./steps"

export { endSession, recordSupportEvent, SUPPORT_RESOURCE } from "./steps"
export type { RequestFacts } from "./steps"

/**
 * A redeemed support grant becomes a session (adr/0061 Ek "Destek
 * erişimi", Karar 3 and 6): the grant claimed once and the session kept
 * (closed again if a later step fails), the start in the shop's audit log,
 * then the owners told by the bell and e-mail. The route has checked the
 * grant and the owner's switch before; it opens the browser's session after.
 */
export const startSupportSessionWorkflow = createWorkflow(
  "support-access-start",
  (input: { session: SupportSession; facts: RequestFacts }) => {
    const session = openSupportSessionStep({ session: input.session })
    recordSupportStartStep({ session, facts: input.facts })
    notifyOwnersStep({ session })
    return new WorkflowResponse(transform({ session }, ({ session: opened }) => opened))
  }
)

/** A session ended before its time, and the end recorded (Karar 4, 6); null if already over. */
export const endSupportSessionWorkflow = createWorkflow(
  "support-access-end",
  (input: {
    grant_id: string
    reason: SupportEndReason
    actor_id: string | null
    facts: RequestFacts
  }) => new WorkflowResponse(endSupportSessionStep(input))
)
