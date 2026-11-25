import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { aiProviderError } from "../../../lib/ai/errors"
import { PLATFORM_SERVICE_ID } from "../../../lib/ai/registry/platform-service"
import { requestAiCreditOrder } from "../../../lib/control-plane/ai-credit-order"
import type { AiCreditOrderOptions } from "../../../lib/control-plane/ai-credit-order"
import { forgetAiCreditsStatus } from "../../../lib/control-plane/ai-credits"
import { ConflictError } from "../../../lib/errors"
import { aiCreditOrderView } from "../credits-view"
import type { AiCreditOrderView } from "../credits-view"
import { aiFlagsOf } from "../connections"

export interface RequestCreditOrderInput {
  pack_id: string
  /** The asking user's id: the control plane keeps it as who asked, never an e-mail. */
  user_id: string
}

const unavailable = (code: string) =>
  aiProviderError({ service: PLATFORM_SERVICE_ID, key: "ai.platform_unavailable", code })

/**
 * Opens the top-up request on the control plane (adr/0085 K11), signed,
 * its body the pack's id and the user's id; the pack's credits and price
 * are the platform's, never sent from here. The flag is checked again
 * (the route's gate aside). An open request already there and a pack no
 * longer offered come back as their keys, any other failure as
 * `ai.platform_unavailable`. Once a request is open the kept status is
 * forgotten, so the card shows it on the next read.
 */
export async function requestCreditOrder(
  container: Parameters<typeof aiFlagsOf>[0],
  input: RequestCreditOrderInput,
  options: AiCreditOrderOptions = {}
): Promise<AiCreditOrderView> {
  if ((await aiFlagsOf(container)).platformCredits !== true) {
    throw unavailable("flag_off")
  }
  const result = await requestAiCreditOrder(
    { packId: input.pack_id, requestedBy: input.user_id },
    options
  )
  if (result.kind === "open") {
    throw new ConflictError("ai.credits_order_open")
  }
  if (result.kind === "pack_unknown") {
    throw new ConflictError("ai.credits_pack_unknown")
  }
  if (result.kind === "unavailable") {
    throw unavailable(result.code)
  }
  forgetAiCreditsStatus()
  return aiCreditOrderView(result.order)
}

/**
 * The workflow's last step, on purpose: nothing after it can fail and
 * undo it. Its compensation has nothing to do: the control plane offers a
 * shop no way to take a request back (only its staff cancel one, and a
 * request opened is no payment: staff mark it paid when they are paid).
 */
export const requestCreditOrderStep = createStep(
  "ai-credits-request-order",
  async (input: RequestCreditOrderInput, { container }) =>
    new StepResponse(await requestCreditOrder(container, input)),
  // Nothing to undo here: a request opened is cancelled by the platform's staff
  () => Promise.resolve()
)
