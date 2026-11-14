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
 * numbers leave as attributes.
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

/** An item's estimated width in its size's characters, with the gap and separator beside it. */
function widthOf(item: MarqueeItemView, size: MarqueeSectionView["size"]): number {
  const sub = item.subtext?.length ?? 0
  const icon = item.icon ? 1 : 0
  switch (size) {
    case "small":
      return item.text.length + (sub > 0 ? sub + 2 : 0) + icon * 3 + 6
    case "medium":
      return Math.max(item.text.length * 1.05, sub * 0.9) + icon * 5 + 7
    case "large":
      return item.text.length + Math.min(sub, 16) * 0.35 + icon + 2
  }
}

export function loopOf(section: Pick<MarqueeSectionView, "items" | "size">): {
  rounds: number
  span: Span
} {
  const round = section.items.reduce((sum, item) => sum + widthOf(item, section.size), 0)
  const fill = FILL[section.size]
  const rounds = Math.min(MAX_ROUNDS, Math.max(1, Math.ceil(fill / Math.max(round, 1))))
  const ratio = (round * rounds) / fill
  return { rounds, span: SPANS.find((span) => ratio <= span) ?? 8 }
}
