import type { AnySection } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"

/** What every section's settings form is given. */
export interface SectionFormProps<T extends AnySection> {
  section: T
  /** The section's mistakes by field, as the save would meet them. */
  problems: SectionProblems
  /**
   * The section's new settings. `field` names the field being typed in:
   * the letters typed in one field undo as one step.
   */
  onChange: (section: T, field?: string) => void
}
