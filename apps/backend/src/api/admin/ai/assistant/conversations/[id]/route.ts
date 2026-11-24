import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  CONVERSATION_ID,
  conversationKey,
  conversationStore,
  loadConversation,
  visibleMessages,
} from "../../../../../../lib/ai/assistant/conversation"

const notFound = () =>
  new MedusaError(MedusaError.Types.NOT_FOUND, "ai.assistant_conversation_gone")

/**
 * GET /admin/ai/assistant/conversations/:id (adr/0079 §9): the signed-in
 * staff member's own conversation as the panel shows it, the person's
 * words and the replies, no tool step. Another's or a lapsed one is 404.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  const record = await loadConversation(conversationStore(), req.auth_context.actor_id, id)
  if (record === null) {
    throw notFound()
  }
  res.json({ conversation_id: id, messages: visibleMessages(record) })
}

/** DELETE /admin/ai/assistant/conversations/:id: "Yeni sohbet" drops one's own at once (§6). */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  if (CONVERSATION_ID.test(id)) {
    await conversationStore().remove(conversationKey(req.auth_context.actor_id, id))
  }
  res.status(200).json({ id, deleted: true })
}
