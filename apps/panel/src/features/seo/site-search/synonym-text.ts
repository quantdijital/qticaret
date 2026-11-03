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

const S = "seo.siteSearch.problems"

/** A group's problems in words: one found while typing, or the server's refusal. */
export function useSynonymText() {
  const { t } = useTranslation()
  const problemText = (name: string, term?: string): string =>
    t(`${S}.${name}`, {
      term: term ?? "",
      min: MIN_GROUP_TERMS,
      max: MAX_GROUP_TERMS,
      words: MAX_TERM_WORDS,
      length: MAX_TERM_LENGTH,
      groups: formatCount(MAX_SYNONYM_GROUPS),
    })
  const failureText = (error: unknown): string => {
    const name = synonymProblemOf(error)
    return name ? problemText(name) : errorText(t, error)
  }
  return { problemText, failureText }
}
