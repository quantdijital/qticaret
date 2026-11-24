import { suggestionProblems, suggestionText } from "../gate"
import { ASSISTANT_TASK } from "../registry/assistant-tasks"
import type { ScreenRef } from "./conversation"
import type { PanelScreen } from "./screens"
import type { AssistantLocale } from "./tools/types"

/**
 * The model's words as the panel gets them (adr/0079 §4, §7): plain text
 * (markup out), a screen named only as `[[key]]` and only when it is one
 * the person sees (any other marker is dropped, never drawn), and the
 * shared gate over the rest. A reply the gate turns down is replaced by
 * a fixed sentence and names no screen. The panel builds every link from
 * `screens`; nothing in the text is ever a link.
 */

const MARKER = /\[\[([^[\]\n]{1,100})\]\]/g
export const MAX_REPLY_SCREENS = 5

const NO_REPLY: Readonly<Record<AssistantLocale, string>> = {
  tr: "Yanıt veremedim. Sorunuzu başka sözcüklerle yazmayı deneyin.",
  en: "I could not answer that. Try asking in other words.",
}

const SCREEN_WORD: Readonly<Record<AssistantLocale, string>> = { tr: "ekran", en: "screen" }

export interface Reply {
  text: string
  screens: ScreenRef[]
  /** The gate's problems when the reply was replaced; empty when it passed. */
  problems: string[]
}

export const noReply = (locale: AssistantLocale, problems: string[] = []): Reply => ({
  text: NO_REPLY[locale],
  screens: [],
  problems,
})

export function replyOf(
  raw: string,
  visible: readonly PanelScreen[],
  locale: AssistantLocale
): Reply {
  const byKey = new Map(visible.map((screen) => [screen.key, screen]))
  const screens: ScreenRef[] = []
  const text = suggestionText(raw)
    .replace(MARKER, (_whole, key: string) => {
      const screen = byKey.get(key.trim())
      if (screen === undefined) {
        return ""
      }
      const named = screens.some((each) => each.key === screen.key)
      if (!named) {
        // Past the limit a known screen is dropped too: a marker without its screen is never kept
        if (screens.length >= MAX_REPLY_SCREENS) {
          return ""
        }
        screens.push({ key: screen.key, label: screen.label })
      }
      return `[[${screen.key}]]`
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim()
  // The gate reads the words: a kept marker is a word to it, not an address
  const words = text.replace(MARKER, SCREEN_WORD[locale])
  const problems = suggestionProblems(ASSISTANT_TASK, words)
  return problems.length === 0 ? { text, screens, problems } : noReply(locale, problems)
}
