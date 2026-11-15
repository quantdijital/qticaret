import type { MarqueeItemView, MarqueeSectionView } from "@qticaret/ui"

/**
 * How many rounds of the items one copy of a scrolling strip holds, and
 * how long it then is (adr/0049 Ek 2026-11-14 §4.1), worked out on the
 * server from the words alone: the loop slides two equal copies by half
 * their width, so one copy must be at least as wide as the widest screen
 * or the strip runs empty at its end. Widths are estimated in characters
 * at each size's face (a short strip repeats, a long one does not), and
 * the loop's time grows with the copy (`span`), so a long strip slides at
 * the speed of a short one. No measuring script, no inline style: both
 * numbers leave as attributes. The room between items (`gap`) and capitals
 * (`uppercase`) widen or narrow the estimate; with large outlined items
 * a copy holds an even count, so filled and outlined alternate across the
 * loop's seam too.
 */

/**
 * A copy's estimated width, in each size's characters, that fills a 2560 px
 * screen with room to spare (measured 2026-11-14: about 7.5, 8.5 and 32 px
 * a character at small, medium and large).
 */
const FILL = { small: 360, medium: 330, large: 86 } as const

/** The rounds a copy holds at most: a single one-letter item on the widest screen. */
const MAX_ROUNDS = 56

/** The loop's time steps against a copy that just fills (`marquee.css` maps each). */
export const SPANS = [1, 1.5, 2, 3, 4, 6, 8] as const
export type Span = (typeof SPANS)[number]

/** The two gaps an item takes (before its separator and after it), in its size's characters. */
const GAP = { small: 6, medium: 7, large: 2 } as const

/** Each room's share of the size's own gap (`marquee-options.css` maps the same). */
export const GAP_SCALE = { tight: 0.5, normal: 1, wide: 1.75 } as const

/** Capitals are wider than the lower case they replace. */
const CAPITALS = 1.2

type Shape = Pick<MarqueeSectionView, "size" | "gap" | "uppercase">

/** An item's estimated width in its size's characters, with the gap and separator beside it. */
function widthOf(item: MarqueeItemView, { size, gap, uppercase }: Shape): number {
  const sub = item.subtext?.length ?? 0
  const icon = item.icon ? 1 : 0
  const text = item.text.length * (uppercase === "on" ? CAPITALS : 1)
  const room = GAP[size] * GAP_SCALE[gap]
  switch (size) {
    case "small":
      return text + (sub > 0 ? sub + 2 : 0) + icon * 3 + room
    case "medium":
      return Math.max(text * 1.05, sub * 0.9) + icon * 5 + room
    case "large":
      return text + Math.min(sub, 16) * 0.35 + icon + room
  }
}

/** Whether every other item is drawn as an outline: large only, as the contract says. */
export const outlined = (section: Pick<MarqueeSectionView, "size" | "outline">): boolean =>
  section.size === "large" && section.outline === "on"

export function loopOf(
  section: Pick<MarqueeSectionView, "items" | "size" | "gap" | "uppercase" | "outline">
): {
  rounds: number
  span: Span
} {
  const round = section.items.reduce((sum, item) => sum + widthOf(item, section), 0)
  const fill = FILL[section.size]
  let rounds = Math.min(MAX_ROUNDS, Math.max(1, Math.ceil(fill / Math.max(round, 1))))
  // An odd copy would set two filled items side by side where the copies meet
  if (outlined(section) && (section.items.length * rounds) % 2 === 1) {
    rounds += 1
  }
  const ratio = (round * rounds) / fill
  return { rounds, span: SPANS.find((span) => ratio <= span) ?? 8 }
}
