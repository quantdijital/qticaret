/**
 * The reading grid of a post, a long page and a legal text. On a phone
 * and a tablet the text keeps its narrow measure (a post's 32rem column
 * from 640 px). On a laptop and a desktop it stands in a column of about
 * 86 letters (46rem, 736 px at 17 px; owner 2026-11-05, second ruling:
 * the 34rem column was "aşırı dar" on computers), the contents in a
 * 14–16rem column on its left at the page's edge, under the trail; what
 * is left stays on the text's right, so at 1440 px and wider the text
 * stands about the page's middle. A post keeps the column from 640 px; a
 * page, whose title stands across the page, from 1024 px.
 */
export interface ReadingGrid {
  /** The grid's tracks, on the container. */
  grid: string
  /** The column of the title, the cover and the text. */
  column: string
  /** The contents' column, on the left from 1024 px. */
  side: string
}

/** The text column's widest, from 1024 px (46rem: about 86 letters a line at 17 px). */
export const READING_WIDTH = 736

const TABLET = "sm:grid-cols-[minmax(0,1fr)_minmax(0,32rem)_minmax(0,1fr)] sm:gap-x-6"
const WITH_SIDE =
  "lg:grid-cols-[minmax(14rem,1fr)_minmax(0,46rem)_minmax(0,1fr)] lg:gap-x-10 xl:grid-cols-[minmax(16rem,1fr)_minmax(0,46rem)_minmax(0,1fr)] xl:gap-x-16"
const WITHOUT_SIDE = "lg:grid-cols-[minmax(0,1fr)_minmax(0,46rem)_minmax(0,1fr)] lg:gap-x-10"

export function readingGrid({
  outline,
  tablet,
}: {
  outline: boolean
  tablet: boolean
}): ReadingGrid {
  const desktop = outline ? WITH_SIDE : WITHOUT_SIDE
  return {
    grid: tablet ? `${TABLET} ${desktop}` : desktop,
    column: tablet ? "sm:col-start-2" : "lg:col-start-2",
    side: "lg:col-start-1 lg:row-start-1",
  }
}
