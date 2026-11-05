import type { CategoryCardView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { CategoryTile } from "../parts/CategoryTile"
import { aisleColumns } from "../sections/aisle-grid"

/**
 * Categories above a listing's grid (its subcategories, a search's
 * related ones) as one row of picture tiles: two and a half on a phone,
 * four and a half from 640 px, eight from 1024 px; more scroll sideways
 * by touch and keys. The row holds links, so it takes no tab stop of its own.
 */
export function TileRail({
  id,
  title,
  categories,
  visibleTitle = false,
}: {
  id: string
  title: string
  categories: readonly CategoryCardView[]
  /** The head shows (a search's "related categories"); otherwise it is the reader's alone. */
  visibleTitle?: boolean
}) {
  if (categories.length === 0) {
    return null
  }
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className={visibleTitle ? "text-title" : "sr-only"}>
        {title}
      </h2>
      <ul className="gf-rail -mx-(--gutter) -my-1 grid auto-cols-[40%] grid-flow-col gap-(--gap-columns) overflow-x-auto scroll-px-(--gutter) px-(--gutter) py-1 sm:auto-cols-[22%] lg:mx-0 lg:auto-cols-[calc((100%_-_7*var(--gap-columns))/8)] lg:scroll-px-0 lg:px-0">
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
