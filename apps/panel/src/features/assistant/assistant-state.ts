import { createContext, useContext } from "react"
import type { AssistantMessage } from "./api"
import type { OpenScreen } from "./open-screen"

/** The shop's flag for the panel assistant (adr/0079 §8; backend `AI_ASSISTANT`). */
export const AI_ASSISTANT_FLAG = "ai.assistant"

export interface AssistantState {
  /** The shop's flag is on: off, nothing of the assistant is drawn, no key opens it. */
  enabled: boolean
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  /**
   * Opens the panel with the words in its box, unsent (⌘K's "Yardımcıya
   * sor"; review O2): sending is the person's own Enter, under the panel's
   * personal data warning.
   */
  ask: (text: string) => void
  send: (text: string) => void
  /** "Yeni sohbet": the server drops the conversation, the tab forgets it. */
  reset: () => void
  messages: AssistantMessage[]
  pending: boolean
  error: unknown
  draft: string
  setDraft: (text: string) => void
  screen: OpenScreen | null
}

const noop = () => undefined

export const ASSISTANT_OFF: AssistantState = {
  enabled: false,
  open: false,
  setOpen: noop,
  toggle: noop,
  ask: noop,
  send: noop,
  reset: noop,
  messages: [],
  pending: false,
  error: null,
  draft: "",
  setDraft: noop,
  screen: null,
}

export const AssistantContext = createContext<AssistantState>(ASSISTANT_OFF)

/** The assistant as the shell's parts see it; outside its provider, or with the flag off, none. */
export const useAssistant = (): AssistantState => useContext(AssistantContext)
