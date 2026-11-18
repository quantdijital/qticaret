/**
 * The category panels' places (adr/0049 Ek 2026-11-19). From 1024 px with
 * the lead on, the first panel stands on the left half, as tall as the
 * rows beside it; the others stack on the right half, one or two to a row
 * (an odd count leaves the first of them alone, across the half), at most
 * `BESIDE_MAX` of them; any more follow in rows filled edge to edge
 * (`collageRows`). With the lead off every screen lays out the collage's
 * rows. Under 1024 px: one panel a row on a phone (two when the shop
 * asks), two on a tablet, the lead alone in its row.
 *
 * A panel is drawn `wide` (its words beside its photo) where it runs half
 * the page or more on a wide screen, or the whole row under 1024 px; a
 * wide-and-flat product photo is not squeezed into a narrow, tall box.
 * The lead is never wide: it is the tall one.
 */
import { collageRows } from "./collage-rows"
import type { CollageSpan } from "./collage-rows"

/** The panels laid beside the lead at most; six categories in all fill it. */
export const BESIDE_MAX = 5

export type PanelScreen = "phone" | "tablet" | "lg" | "xl"

export interface PanelPlace {
  phone: 6 | 12
  tablet: 6 | 12
  lg: CollageSpan
  xl: CollageSpan
  /** The rows the lead runs down beside the others from 1024 px (1 for every other panel). */
  rows: number
  /** The first panel, drawn large. */
  lead: boolean
  /** The screens where the panel is drawn wide: its words beside its photo. */
  wide: PanelScreen[]
}

/** The panels beside the lead, row by row: one or two a row, the odd one first and alone. */
export function besideRows(count: number): (1 | 2)[] {
  if (count <= 0) {
    return []
  }
  if (count <= 2) {
    return Array.from({ length: count }, () => 1 as const)
  }
  const pairs = Math.floor(count / 2)
  return [
    ...(count % 2 === 1 ? [1 as const] : []),
    ...Array.from({ length: pairs }, () => 2 as const),
  ]
}

/** The wide screens' spans: the lead and the panels beside it, then rows for any more. */
function wideSpans(
  count: number,
  lead: boolean,
  perRow: number
): { span: CollageSpan; rows: number }[] {
  if (!lead || count < 2) {
    return collageRows(count, false, perRow).map(({ span }) => ({ span, rows: 1 }))
  }
  const beside = besideRows(Math.min(count - 1, BESIDE_MAX))
  const spans: { span: CollageSpan; rows: number }[] = [{ span: 6, rows: beside.length }]
  for (const inRow of beside) {
    for (let index = 0; index < inRow; index += 1) {
      spans.push({ span: inRow === 2 ? 3 : 6, rows: 1 })
    }
  }
  const rest = count - spans.length
  for (const { span } of collageRows(rest, false, perRow)) {
    spans.push({ span, rows: 1 })
  }
  return spans
}

/** Every panel's place at each screen (`columns`: panels a row from 1280 px while the lead is off). */
export function panelPlaces(
  count: number,
  lead: boolean,
  columns: number,
  phoneColumns: 1 | 2
): PanelPlace[] {
  const leading = lead && count > 1
  const pairs = collageRows(count, leading, 2)
  const lg = wideSpans(count, leading, Math.min(columns, 3))
  const xl = wideSpans(count, leading, columns)
  return pairs.map((pair, index) => {
    const first = leading && index === 0
    const tablet = pair.span === 12 ? 12 : 6
    const phone = phoneColumns === 2 ? tablet : 12
    const atLg = lg[index] ?? { span: 12 as const, rows: 1 }
    const atXl = xl[index] ?? atLg
    const wide: PanelScreen[] = first
      ? []
      : [
          ...(phone === 12 ? (["phone"] as const) : []),
          ...(tablet === 12 ? (["tablet"] as const) : []),
          ...(atLg.span >= 6 ? (["lg"] as const) : []),
          ...(atXl.span >= 6 ? (["xl"] as const) : []),
        ]
    return { phone, tablet, lg: atLg.span, xl: atXl.span, rows: atXl.rows, lead: first, wide }
  })
}
