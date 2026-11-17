import { useTranslation } from "react-i18next"
import type { FooterBlock } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { useProblemText } from "../forms/problem-text"
import { FOOTER_ROWS_FIELD_IDS, blockLabel } from "./footer-rows-fields"
import type { BlockField } from "./footer-rows-fields"

/** What every block form gets: its block, the footer's problems and the change (with the field typed in). */
export interface BlockFormProps<B extends FooterBlock = FooterBlock> {
  block: B
  problems: SectionProblems
  onChange: (block: B, field?: string) => void
}

/**
 * The block forms' shared pieces: a field's id, its everyday name and
 * term, the problem the draft has with it, as one call, so each type's
 * form stays a list of its fields.
 */
export function useBlockKit<B extends FooterBlock>({ block, problems }: BlockFormProps<B>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  return {
    t,
    id: (field: BlockField) => FOOTER_ROWS_FIELD_IDS.block(block.id, field),
    names: (field: BlockField) => {
      const keys = blockLabel(field)
      return { label: t(keys.label), term: t(keys.term) }
    },
    error: (field: BlockField, max?: number) =>
      problem(problems[`blocks.${block.id}.${field}`], max),
  }
}
