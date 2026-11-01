import type { Translate } from "@qticaret/ui"
import tr from "./tr.json"

export type MessageKey = keyof typeof tr

const MESSAGES: Readonly<Record<string, string>> = tr

/**
 * The storefront's words (CLAUDE.md rule 9: Turkish UI text by key). One
 * language until F19. A missing key shows the key itself, which a test
 * catches before a shopper does.
 */
export const t: Translate = (key, values) => {
  const text = MESSAGES[key] ?? key
  return values
    ? text.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = values[name]
        return value === undefined ? match : String(value)
      })
    : text
}
