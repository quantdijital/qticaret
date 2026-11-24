import { useTranslation } from "react-i18next"
import { HAND_NOTE_MAX } from "@qticaret/types"
import { TextField } from "./fields"
import { PREVIEW_IDS } from "./preview-fields"
import { useProblemText } from "./problem-text"
import type { Problem } from "@/features/storefront/layout/problems"

/**
 * A section's hand note (sahip 2026-11-24, "el yazısı not"): a short line
 * of plain text over the heading, in handwriting while the theme's accent
 * face is on (Tema > Yazı tipleri), else italic; empty: none. Plain text,
 * so no shop details are offered. Its id is the preview's (`note`), so a
 * pressed note in the preview opens it.
 */
export function HandNoteField({
  sectionId,
  keys,
  value,
  problem,
  onChange,
}: {
  sectionId: string
  /** The section's own keys: `storefront.editor.heroFull` or `storefront.editor.banner`. */
  keys: string
  value: string | null
  /** The save's problem with the note, if any. */
  problem: Problem | undefined
  onChange: (note: string | null) => void
}) {
  const { t } = useTranslation()
  const text = useProblemText()
  return (
    <TextField
      id={PREVIEW_IDS.text(sectionId, "note")}
      label={t(`${keys}.note.label`)}
      term={t(`${keys}.note.term`)}
      value={value}
      max={HAND_NOTE_MAX}
      placeholder={t(`${keys}.note.placeholder`)}
      hint={t(`${keys}.note.hint`)}
      error={text(problem, HAND_NOTE_MAX)}
      onChange={onChange}
    />
  )
}
