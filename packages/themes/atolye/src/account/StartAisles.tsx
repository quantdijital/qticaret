import type { CategoryCardView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { CategoryTile } from "../parts/CategoryTile"
import { columnsFor } from "../sections/aisle-grid"

const MOST = 8
const COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
}

/**
 * The shop's categories as picture tiles under an empty list (no orders,
 * no favourites yet), the place to start: a row that scrolls sideways on
 * a phone (two and a bit in sight), from 1024 px a grid in the account's
 * column, three or four across so no tile stands alone on its row.
 */
export function StartAisles({
  id,
  title,
  categories,
}: {
  id: string
  title: string
  categories: readonly CategoryCardView[]
}) {
  const shown = categories.slice(0, MOST)
  if (shown.length === 0) {
    return null
  }
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <h2 id={id} className="text-title">
        {title}
      </h2>
      <ul
        className={cn(
          "gf-rail -mx-(--gutter) grid auto-cols-[44%] grid-flow-col gap-(--gap-columns) overflow-x-auto scroll-px-(--gutter) px-(--gutter) sm:auto-cols-[30%] lg:mx-0 lg:grid-flow-row lg:overflow-visible lg:px-0",
          COLUMNS[columnsFor(shown.length, [3, 4], 4)]
        )}
      >
        {shown.map((category) => (
          <li key={category.path} className="min-w-0">
            <CategoryTile
              category={category}
              sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 44vw"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
