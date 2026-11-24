import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { assistantTurnWorkflow } from "../../../../../workflows/ai/assistant-turn"
import { turnError } from "../../../../../workflows/ai/steps/assistant-turn"
import type { AdminPostAssistantTurnType } from "../validators"

/**
 * POST /admin/ai/assistant/turns (adr/0079): one turn of the panel
 * assistant for the signed-in staff member. Answers the conversation's id
 * and this turn's messages: the person's (personal data patterns taken
 * out, as it was sent) and the reply, plain text whose screens are keys of
 * the panel's map (`screens`), from which the panel builds its links. A
 * turn that did not answer is its `ai.*` error.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostAssistantTurnType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const { result } = await assistantTurnWorkflow(req.scope).run({
    input: {
      user_id: req.auth_context.actor_id,
      conversation_id: body.conversation_id ?? null,
      message: body.message,
      locale: body.locale ?? "tr",
      screen: body.screen ?? null,
      service: body.service ?? null,
    },
  })
  if (result.error !== null) {
    throw turnError(result.service, result.error)
  }
  res.json({ conversation_id: result.conversation_id, messages: result.messages })
}
