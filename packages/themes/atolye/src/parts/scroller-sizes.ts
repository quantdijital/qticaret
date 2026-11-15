import type { ScrollerSettings } from "@qticaret/types"

/**
 * How wide a scrolling row's card photo shows, for its `sizes`, from the
 * cards in view at each width (`scroller.css`; the container stops at
 * 1440 px with 48 px gutters and 24 px gaps).
 */
const PHONE: Record<ScrollerSettings["mobile"], string> = {
  one: "92vw",
  peek: "62vw",
  two: "46vw",
}

const WIDE: Record<ScrollerSettings["desktop"], string> = {
  three: "(min-width: 1440px) 432px, (min-width: 768px) 30vw",
  four: "(min-width: 1440px) 318px, (min-width: 1024px) 22vw, (min-width: 768px) 30vw",
  five: "(min-width: 1440px) 250px, (min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 768px) 30vw",
  six: "(min-width: 1440px) 204px, (min-width: 1280px) 15vw, (min-width: 1024px) 22vw, (min-width: 768px) 30vw",
}

export const scrollerSizes = (settings: ScrollerSettings): string =>
  `${WIDE[settings.desktop]}, ${PHONE[settings.mobile]}`
