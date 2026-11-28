import { fieldMark } from "@qticaret/ui"
import type { HeadLinesView } from "@qticaret/ui"
import { BrushStroke } from "../parts/BrushStroke"
import { Eyebrow } from "../parts/Eyebrow"
import { HandNote } from "../parts/HandNote"

/**
 * A section heading's two lines (sahip 2026-11-28), drawn as the figures
 * strip's (`stats-parts.tsx`): the small upper-case line over the heading
 * (`Eyebrow`) and the hand note beside it, tilted, a brush stroke in the
 * accent under it. Each draws nothing until the shop wrote it.
 */
export function HeadEyebrow({
  lines,
  marks,
}: {
  lines: HeadLinesView | undefined
  marks?: boolean | undefined
}) {
  return lines?.eyebrow ? <Eyebrow text={lines.eyebrow} mark={fieldMark(marks, "eyebrow")} /> : null
}

export function HeadNote({
  lines,
  marks,
}: {
  lines: HeadLinesView | undefined
  marks?: boolean | undefined
}) {
  return lines?.note ? (
    <div className="w-fit shrink-0 pb-1">
      <HandNote note={lines.note} mark={fieldMark(marks, "note")} className="-rotate-6 text-text" />
      <BrushStroke className="ml-0 text-(--highlight)" />
    </div>
  ) : null
}
