import { LIMIT_KEYS, isGrantLimit } from "@qticaret/types/control-plane"
import type { LimitKey } from "@qticaret/types/control-plane"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { parseCountInput } from "@qticaret/admin-ui/lib/money-input"

/** A limit as the form holds it: its text, or no limit. */
export interface LimitDraft {
  text: string
  unlimited: boolean
}

export type LimitDrafts = Record<LimitKey, LimitDraft>

/** A grant (adr/0085 K5) is never "no limit": without a value it is 0. */
const valueOf = (key: LimitKey, value: number | null | undefined) =>
  isGrantLimit(key) ? (value ?? 0) : value

export const draftsOf = (limits: Partial<Record<LimitKey, number | null>> | null): LimitDrafts =>
  Object.fromEntries(
    LIMIT_KEYS.map((key) => {
      const value = valueOf(key, limits?.[key])
      return [
        key,
        {
          text: value === null || value === undefined ? "" : formatCount(value),
          unlimited: value === null,
        },
      ]
    })
  ) as LimitDrafts

/** The drafts as values; null when one is neither a whole number nor "no limit". */
export function limitsOf(drafts: LimitDrafts): Record<LimitKey, number | null> | null {
  const values: Partial<Record<LimitKey, number | null>> = {}
  for (const key of LIMIT_KEYS) {
    const draft = drafts[key]
    const value = draft.unlimited ? null : parseCountInput(draft.text)
    if (!draft.unlimited && value === null) {
      return null
    }
    values[key] = value
  }
  return values as Record<LimitKey, number | null>
}
