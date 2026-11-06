import { useTranslation } from "react-i18next"
import { findingsNote } from "@/features/content/section-findings"
import type { SectionFindings } from "@/features/content/section-findings"

/**
 * What the advisor found for a card in a text's narrow column ("1 öneri"),
 * under its fields as the product page's side cards say it; none, nothing.
 */
export function FindingsNote({ findings }: { findings: SectionFindings }) {
  const { t } = useTranslation()
  const note = findingsNote(t, findings)
  return note ? <p className="border-t pt-3 text-xs text-warning-text">{note}</p> : null
}
