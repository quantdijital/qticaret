import type { ShelfColumns } from "@qticaret/types"

/**
 * A shelf's grid from the shop's cards-in-a-row (adr/0049 Ek 2026-11-05):
 * its count from 1280 px, fewer below so a card stays readable (5 → 4 at
 * 1024–1279 → 3 at 768–1023; 4 → 3 at 768–1279; 3 from 768) and two on a
 * phone. Each width shows two full rows (three rows of two on a phone);
 * when the products do not fill them, whole rows only, unless there are
 * fewer than one row. Classes are written out whole for Tailwind.
 */

type Step = "phone" | "md" | "lg" | "xl"

const STEPS: readonly Step[] = ["phone", "md", "lg", "xl"]

/** Cards in a row at each width for the shop's count. */
const ACROSS: Record<ShelfColumns, Record<Step, number>> = {
  3: { phone: 2, md: 3, lg: 3, xl: 3 },
  4: { phone: 2, md: 3, lg: 3, xl: 4 },
  5: { phone: 2, md: 3, lg: 4, xl: 5 },
}

/** Rows a width shows: two, three of two on a phone (six cards, as before the setting). */
const ROWS: Record<Step, number> = { phone: 3, md: 2, lg: 2, xl: 2 }

/** The grid's columns past the two (phone) and three (768 px) every product grid has. */
const GRID: Record<ShelfColumns, string> = {
  3: "",
  4: "xl:grid-cols-[repeat(4,minmax(0,1fr))]",
  5: "lg:grid-cols-[repeat(4,minmax(0,1fr))] xl:grid-cols-[repeat(5,minmax(0,1fr))]",
}

/** A card shown or left out from a width on: [shown, left out]. */
const DISPLAY: Record<Step, readonly [string, string]> = {
  phone: ["", "hidden"],
  md: ["md:block", "md:hidden"],
  lg: ["lg:block", "lg:hidden"],
  xl: ["xl:block", "xl:hidden"],
}

/**
 * How wide a card's photo shows, for its `sizes` (the container stops at
 * 1440 px with 48 px gutters and 24 px gaps): 432, 318 or 250 px there.
 */
const SIZES: Record<ShelfColumns, string> = {
  3: "(min-width: 1440px) 432px, (min-width: 768px) 30vw, 46vw",
  4: "(min-width: 1440px) 318px, (min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw",
  5: "(min-width: 1440px) 250px, (min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw",
}

/** The shop's setting, 3 when it says none (a backend from before it). */
export const shelfColumns = (value: number | undefined): ShelfColumns =>
  value === 4 || value === 5 ? value : 3

/** How many of `count` cards a width shows: its full rows, or all when not one row. */
function shownAt(columns: ShelfColumns, step: Step, count: number): number {
  const across = ACROSS[columns][step]
  if (count < across) {
    return count
  }
  const room = Math.min(count, across * ROWS[step])
  return room - (room % across)
}

/**
 * How many of the section's `count` products the shelf draws: as many as
 * its widest showing takes (at most two rows of the shop's count: 6, 8
 * or 10); none drawn that no width shows.
 */
export const shelfCount = (columns: ShelfColumns, count: number): number =>
  Math.max(...STEPS.map((step) => shownAt(columns, step, count)))

/** The grid's column classes for the shop's count. */
export const shelfGrid = (columns: ShelfColumns): string => GRID[columns]

/** The photos' `sizes` for the shop's count. */
export const shelfSizes = (columns: ShelfColumns): string => SIZES[columns]

/** The card's display classes: left out where its row would not be full. */
export function shelfCard(columns: ShelfColumns, count: number, index: number): string {
  const out: string[] = []
  let shown = true
  for (const step of STEPS) {
    const now = index < shownAt(columns, step, count)
    if (now !== shown) {
      out.push(DISPLAY[step][now ? 0 : 1])
      shown = now
    }
  }
  return out.join(" ")
}
