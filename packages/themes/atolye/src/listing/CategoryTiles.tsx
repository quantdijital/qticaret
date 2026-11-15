import type { CategoryCardView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { CategoryTile } from "../parts/CategoryTile"
import { aisleColumns } from "../sections/aisle-grid"

/** A rail that takes `n` of the eight columns from 1024 px: its tiles keep the eight-column size. */
const SPAN: Record<number, readonly [section: string, rail: string]> = {
  1: ["lg:col-span-1", "lg:auto-cols-[100%]"],
  2: ["lg:col-span-2", "lg:auto-cols-[calc((100%_-_var(--gap-columns))/2)]"],
  3: ["lg:col-span-3", "lg:auto-cols-[calc((100%_-_2*var(--gap-columns))/3)]"],
  4: ["lg:col-span-4", "lg:auto-cols-[calc((100%_-_3*var(--gap-columns))/4)]"],
  5: ["lg:col-span-5", "lg:auto-cols-[calc((100%_-_4*var(--gap-columns))/5)]"],
  6: ["lg:col-span-6", "lg:auto-cols-[calc((100%_-_5*var(--gap-columns))/6)]"],
}

/**
 * Categories above a listing's grid (its subcategories, a search's
 * related ones) as one row of picture tiles: two and a half on a phone,
 * four and a half from 640 px, eight from 1024 px; more scroll sideways
 * by touch and keys. The row holds links, so it takes no tab stop of its own.
 * `span`: in a grid of eight columns, the rail takes that many (its tiles
 * the same size) and something else stands in the rest.
 */
export function TileRail({
  id,
  title,
  categories,
  visibleTitle = false,
  span,
}: {
  id: string
  title: string
  categories: readonly CategoryCardView[]
  /** The head shows (a search's "related categories"); otherwise it is the reader's alone. */
  visibleTitle?: boolean
  /** Columns of eight it takes from 1024 px (1–6); none: the whole row. */
  span?: number | undefined
}) {
  if (categories.length === 0) {
    return null
  }
  const part = span === undefined ? undefined : SPAN[span]
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-4", part?.[0])}>
      <h2 id={id} className={visibleTitle ? "text-title" : "sr-only"}>
        {title}
      </h2>
      <ul
        className={cn(
          "gf-rail -mx-(--gutter) -my-1 grid auto-cols-[40%] grid-flow-col items-stretch gap-(--gap-columns) overflow-x-auto scroll-px-(--gutter) px-(--gutter) py-1 sm:auto-cols-[22%] lg:mx-0 lg:scroll-px-0 lg:px-0",
          part?.[1] ?? "lg:auto-cols-[calc((100%_-_7*var(--gap-columns))/8)]"
        )}
      >
        {categories.map((category) => (
          <li key={category.path} className="min-w-0">
            <CategoryTile
              category={category}
              compact
              sizes="(min-width: 1440px) 160px, (min-width: 1024px) 12vw, (min-width: 640px) 22vw, 40vw"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The shop's categories as a full grid of tiles (a search that found
 * nothing): the home aisles' grid, its columns following the count so no
 * tile stands alone on the last row; two across on a phone.
 */
export function TileGrid({
  id,
  title,
  categories,
}: {
  id: string
  title: string
  categories: readonly CategoryCardView[]
}) {
  if (categories.length === 0) {
    return null
  }
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6">
      <h2 id={id} className="text-title">
        {title}
      </h2>
      <ul
        className={cn(
          "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-(--gap-columns) sm:grid-cols-[repeat(3,minmax(0,1fr))]",
          aisleColumns(categories.length)
        )}
      >
        {categories.map((category) => (
          <li key={category.path} className="min-w-0">
            <CategoryTile
              category={category}
              sizes="(min-width: 1280px) 15vw, (min-width: 1024px) 19vw, (min-width: 640px) 30vw, 46vw"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
