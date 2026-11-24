import { z } from "@medusajs/framework/zod"
import { CONVERSATION_ID } from "../../../../lib/ai/assistant/conversation"
import { ASSISTANT_RECORD_ID, ASSISTANT_RECORD_TYPES } from "../../../../lib/ai/assistant/system"
import { SCREEN_KEY } from "../../../../lib/ai/assistant/tools/navigate"

/** The longest message a person may send in one turn (adr/0079 §8, the context budget). */
export const ASSISTANT_MESSAGE_MAX = 2_000

/**
 * `POST /admin/ai/assistant/turns` (adr/0079 §4, §7): the conversation's
 * id, the new message and the open screen, nothing more. Strict: a
 * history, a tool result or a role sent along is refused, never read; the
 * conversation is the server's.
 */
export const AdminPostAssistantTurn = z
  .object({
    conversation_id: z.string().regex(CONVERSATION_ID).nullish(),
    message: z.string().trim().min(1).max(ASSISTANT_MESSAGE_MAX),
    screen: z
      .object({
        key: z.string().regex(SCREEN_KEY),
        record: z
          .object({
            // Security review D4: a closed kind and a Medusa id, nothing free to the model
            type: z.enum(ASSISTANT_RECORD_TYPES),
            id: z.string().regex(ASSISTANT_RECORD_ID),
          })
          .strict()
          .optional(),
      })
      .strict()
      .nullish(),
    locale: z.enum(["tr", "en"]).optional(),
    service: z.string().max(50).nullish(),
  })
  .strict()

export type AdminPostAssistantTurnType = z.infer<typeof AdminPostAssistantTurn>
