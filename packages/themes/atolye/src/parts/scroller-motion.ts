import type { ScrollerStep } from "@qticaret/types"

/** How long a page stays while the row turns by itself, by the shop's step (ms). */
export const SCROLLER_INTERVAL: Readonly<Record<ScrollerStep<"speed">, number>> = {
  slow: 7000,
  medium: 5000,
  fast: 3500,
}

/** What the row's arrows and dots need to know of where it stands. */
export interface ScrollerPlace {
  start: boolean
  end: boolean
  page: number
  pages: number
}

/** A pixel or two of rounding at either end still counts as the end. */
const SLACK = 2

type Track = Pick<HTMLElement, "scrollLeft" | "scrollWidth" | "clientWidth">

/** Where the row stands: at its start or end, and its page among how many (a page: the width in view). */
export function placeOf(track: Track): ScrollerPlace {
  const max = Math.max(0, track.scrollWidth - track.clientWidth)
  const width = Math.max(1, track.clientWidth)
  const pages = max <= SLACK ? 1 : Math.ceil(max / width) + 1
  const end = track.scrollLeft >= max - SLACK
  return {
    start: track.scrollLeft <= SLACK,
    end,
    pages,
    page: end ? pages - 1 : Math.min(pages - 1, Math.round(track.scrollLeft / width)),
  }
}

/**
 * One card's stride in the row: from the first card's start to the
 * second's (its width and the gap); a row of one card, or one not laid
 * out yet, strides a page.
 */
export function cardStride(track: Track & Pick<HTMLElement, "children">): number {
  const [first, second] = Array.from(track.children) as HTMLElement[]
  const stride = first && second ? second.offsetLeft - first.offsetLeft : 0
  return stride > 0 ? stride : track.clientWidth
}

/**
 * Where a step lands: a page on (or `stride` px, a card's when it turns by
 * itself one card at a time; the snap points settle it on a card), at
 * the end the first again when the row loops (and the last before the
 * first); else it stays at the end.
 */
export function stepTarget(
  track: Track,
  by: -1 | 1,
  loop: boolean,
  stride = track.clientWidth
): number {
  const max = Math.max(0, track.scrollWidth - track.clientWidth)
  if (by === 1 && track.scrollLeft >= max - SLACK) {
    return loop ? 0 : max
  }
  if (by === -1 && track.scrollLeft <= SLACK) {
    return loop ? max : 0
  }
  return Math.min(max, Math.max(0, track.scrollLeft + by * stride))
}

/** A page's place: its width in view times its number, never past the end. */
export const pageTarget = (track: Track, page: number): number =>
  Math.min(Math.max(0, track.scrollWidth - track.clientWidth), page * track.clientWidth)
