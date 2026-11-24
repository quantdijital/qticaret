import { isConversationId, messageOf } from "./api"
import type { AssistantMessage } from "./api"

/**
 * What the browser keeps of the assistant (adr/0079 §6, §9): the
 * conversation's id and the messages on screen in the tab's own
 * `sessionStorage` (gone with the tab, and on sign-out), the panel's
 * width in `localStorage`. Storage may be off or full: every read and
 * write is allowed to fail, the panel then simply forgets.
 */

const SESSION_KEY = "qt.assistant.session"
const WIDTH_KEY = "qt.assistant.width"
const MAX_KEPT = 40

export const WIDTH_MIN = 320
export const WIDTH_MAX = 640
export const WIDTH_DEFAULT = 384

export interface AssistantSession {
  conversationId: string | null
  messages: AssistantMessage[]
}

export const EMPTY_SESSION: AssistantSession = { conversationId: null, messages: [] }

/**
 * The tab's conversation, if it is this staff member's (`userId`). One
 * kept by someone else (a session that ran out, another sign-in in the
 * tab; review O1), or by no one known, is dropped unread.
 */
export function loadSession(userId: string | null): AssistantSession {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (raw === null || userId === null) {
      return EMPTY_SESSION
    }
    const data = JSON.parse(raw) as {
      userId?: unknown
      conversationId?: unknown
      messages?: unknown
    } | null
    if (data?.userId !== userId) {
      clearSession()
      return EMPTY_SESSION
    }
    return {
      conversationId: isConversationId(data.conversationId) ? data.conversationId : null,
      messages: Array.isArray(data.messages)
        ? data.messages.flatMap((each) => messageOf(each) ?? []).slice(-MAX_KEPT)
        : [],
    }
  } catch {
    return EMPTY_SESSION
  }
}

/** Kept under its owner's id: nobody else's tab reads it back. Unknown whose, it is not kept. */
export function saveSession(session: AssistantSession, userId: string | null): void {
  try {
    if (userId === null || (session.conversationId === null && session.messages.length === 0)) {
      window.sessionStorage.removeItem(SESSION_KEY)
      return
    }
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ userId, ...session, messages: session.messages.slice(-MAX_KEPT) })
    )
  } catch {
    // Storage off or full: the conversation lives on the server
  }
}

/** Any end of the session: the tab forgets the conversation (the server drops it too, §6). */
export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Nothing kept to clear
  }
}

export const clampWidth = (width: number): number =>
  Math.round(Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, width)))

export function loadWidth(): number {
  try {
    const raw = Number(window.localStorage.getItem(WIDTH_KEY))
    return Number.isFinite(raw) && raw > 0 ? clampWidth(raw) : WIDTH_DEFAULT
  } catch {
    return WIDTH_DEFAULT
  }
}

export function saveWidth(width: number): void {
  try {
    window.localStorage.setItem(WIDTH_KEY, String(clampWidth(width)))
  } catch {
    // Not remembered this time; the panel keeps its width until reloaded
  }
}
