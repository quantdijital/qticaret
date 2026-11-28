import { useTranslation } from "react-i18next"
import { SECTION_EYEBROW_MAX } from "@qticaret/types"
import type { StoreHeadLines } from "@qticaret/types"
import { F, TextField } from "./fields"
import { HandNoteField } from "./hand-note-field"
import { PREVIEW_IDS } from "./preview-fields"
import { useProblemText } from "./problem-text"
import type { Problem } from "@/features/storefront/layout/problems"

const K = "storefront.editor.headLines"

/**
 * A section heading's two optional lines (sahip 2026-11-28): the small
 * upper-case line over it ("Üst satır", shop details allowed) and the hand
 * note beside it ("El yazısı not"); each empty: not drawn. Shared by the
 * product rail, the categories, the departures, the reviews and the posts
 * (whose upper line keeps its own 40 characters, `eyebrowMax`).
 */
export function HeadLinesFields<T extends StoreHeadLines>({
  section,
  sectionId,
  problems,
  eyebrowMax = SECTION_EYEBROW_MAX,
  onChange,
}: {
  section: T
  sectionId: string
  problems: Partial<Record<string, Problem>>
  eyebrowMax?: number
  onChange: (next: T, field: string) => void
}) {
  const { t } = useTranslation()
  const problem = useProblemText()
  return (
    <>
      <TextField
        id={PREVIEW_IDS.text(sectionId, "eyebrow")}
        label={t(`${F}.eyebrow`)}
        hint={t(`${K}.eyebrowHint`)}
        value={section.eyebrow ?? null}
        max={eyebrowMax}
        tokens
        placeholder={t(`${K}.eyebrowPlaceholder`)}
        error={problem(problems["eyebrow"], eyebrowMax)}
        onChange={(eyebrow) => {
          onChange({ ...section, eyebrow }, "eyebrow")
        }}
      />
      <HandNoteField
        sectionId={sectionId}
        keys={K}
        value={section.note ?? null}
        problem={problems["note"]}
        onChange={(note) => {
          onChange({ ...section, note }, "note")
        }}
      />
    </>
  )
}
