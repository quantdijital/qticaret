/**
 * The reading grid of a post and a long page (owner 2026-11-05: "içerik
 * genele yayılmış, başlık ortalanmış"): the title, the cover and the text
 * share one column of about 68 letters (32rem at 16 px, 34rem at 17 px),
 * centred on the page and never across it. From 1024 px the contents
 * stand in a narrow column on its left and the same room stays empty on
 * its right. A post keeps the column from 640 px; a page, whose title
 * stands across the page, from 1024 px.
 */
export interface ReadingGrid {
  /** The grid's tracks, on the container. */
  grid: string
  /** The column of the title, the cover and the text. */
  column: string
  /** The contents' column, on the left from 1024 px. */
  side: string
}

const TABLET = "sm:grid-cols-[minmax(0,1fr)_minmax(0,32rem)_minmax(0,1fr)] sm:gap-x-6"
const WITH_SIDE = "lg:grid-cols-[minmax(13rem,1fr)_minmax(0,34rem)_minmax(0,1fr)] lg:gap-x-10"
const WITHOUT_SIDE = "lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)_minmax(0,1fr)] lg:gap-x-10"

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
