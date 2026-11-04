import { useTranslation } from "react-i18next"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"
import { MAX_SYNONYM_GROUPS } from "@/features/seo/api/synonyms"
import {
  MAX_GROUP_TERMS,
  MAX_TERM_LENGTH,
  MAX_TERM_WORDS,
  MIN_GROUP_TERMS,
  synonymProblemOf,
} from "./terms"

const S = "seo.siteSearch"

/** The group's rules as the texts take them: 2–10 terms, 3 words, 60 characters. */
export const SYNONYM_RULES = {
  min: MIN_GROUP_TERMS,
  max: MAX_GROUP_TERMS,
  words: MAX_TERM_WORDS,
  length: MAX_TERM_LENGTH,
} as const

/**
 * A group's rules and problems in the panel's own words: one found while
 * typing, or the server's refusal by its key (never the server's wording).
 */
export function useSynonymText() {
  const { t } = useTranslation()
  const problemText = (name: string): string =>
    t(`${S}.problems.${name}`, { ...SYNONYM_RULES, groups: formatCount(MAX_SYNONYM_GROUPS) })
  const failureText = (error: unknown): string => {
    const name = synonymProblemOf(error)
    return name ? problemText(name) : errorText(t, error)
  }
  const ruleText = (key: "description" | "hint"): string => t(`${S}.form.${key}`, SYNONYM_RULES)
  return { problemText, failureText, ruleText }
}
