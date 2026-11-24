import { postAi } from "@/features/ai/api/suggestions"
import { sdk } from "@/lib/sdk"
import type { OpenScreen } from "./open-screen"

/**
 * The panel assistant's routes (adr/0079 §2, §4): one turn at a time, the
 * conversation's id and the new message only; the conversation itself is
 * the server's. The answer's text is plain, its screens are keys of the
 * panel's map; nothing in it is ever drawn as a link but those.
 */

/** A screen a reply names: a key of the panel's map and its label's i18n key. */
export interface AssistantScreenRef {
  key: string
  label: string
}

export interface AssistantMessage {
  role: "user" | "assistant"
  text: string
  screens?: AssistantScreenRef[]
}

export interface AssistantTurnAnswer {
  conversation_id: string
  messages: AssistantMessage[]
}

export interface AssistantTurnRequest {
  conversationId: string | null
  message: string
  screen: OpenScreen | null
  locale: "tr" | "en"
}

// Our own map's keys only: anything else in a body is not kept
const SCREEN_KEY = /^[A-Za-z0-9._-]{1,100}$/
const CONVERSATION_ID = /^aiconv_[0-9a-f]{32}$/

const screensOf = (value: unknown): AssistantScreenRef[] =>
  Array.isArray(value)
    ? value.flatMap((each): AssistantScreenRef[] => {
        const ref = each as Partial<AssistantScreenRef> | null
        return typeof ref?.key === "string" &&
          SCREEN_KEY.test(ref.key) &&
          typeof ref.label === "string"
          ? [{ key: ref.key, label: ref.label }]
          : []
      })
    : []

/** A message as the panel keeps it: its role, its text, the screens it may offer. */
export function messageOf(value: unknown): AssistantMessage | null {
  const message = value as Partial<AssistantMessage> | null
  if (
    (message?.role !== "user" && message?.role !== "assistant") ||
    typeof message.text !== "string"
  ) {
    return null
  }
  const screens = screensOf(message.screens)
  return {
    role: message.role,
    text: message.text,
    ...(message.role === "assistant" && screens.length > 0 ? { screens } : {}),
  }
}

export const isConversationId = (value: unknown): value is string =>
  typeof value === "string" && CONVERSATION_ID.test(value)

/** `POST /admin/ai/assistant/turns`: a failure keeps the backend's `ai.*` key (`AiFailure`). */
export async function postAssistantTurn(
  request: AssistantTurnRequest
): Promise<AssistantTurnAnswer> {
  const data = (await postAi("/admin/ai/assistant/turns", {
    ...(request.conversationId === null ? {} : { conversation_id: request.conversationId }),
    message: request.message,
    ...(request.screen === null ? {} : { screen: request.screen }),
    locale: request.locale,
  })) as { conversation_id?: unknown; messages?: unknown } | null
  const messages = Array.isArray(data?.messages)
    ? data.messages.flatMap((each) => messageOf(each) ?? [])
    : []
  if (!isConversationId(data?.conversation_id)) {
    throw new Error("assistant: no conversation")
  }
  return { conversation_id: data.conversation_id, messages }
}

/** `DELETE /admin/ai/assistant/conversations/:id`: "Yeni sohbet" drops it on the server at once. */
export async function deleteAssistantConversation(id: string): Promise<void> {
  await sdk.client.fetch(`/admin/ai/assistant/conversations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}
