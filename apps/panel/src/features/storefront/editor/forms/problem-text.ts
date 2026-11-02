import { useTranslation } from "react-i18next"
import type { Problem } from "@/features/storefront/layout/problems"

/** A problem as a sentence; `max` fills a length limit's. */
export function useProblemText() {
  const { t } = useTranslation()
  return (problem: Problem | undefined, max?: number): string | undefined =>
    problem ? t(`storefront.editor.problems.${problem}`, { max }) : undefined
}
