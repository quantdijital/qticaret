import type { CategoryCardView, LinkView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { CategoryTile } from "../parts/CategoryTile"
import { Container } from "../parts/Container"
import { aisleColumns } from "./aisle-grid"
import { SectionHead } from "./SectionHead"

/**
 * The shop's categories as aisles, right under the first screen: every
 * category one tile of the same size, its picture (the shop's own, else
 * its newest product's photo, chosen by the storefront) with its name on
 * the tile's graphite foot; a category without any picture is its name
 * on the same graphite tile. Under 1024 px the tiles stand in one row that
 * scrolls sideways; from 1024 px in a grid whose columns follow the count
 * (`aisle-grid.ts`), so no tile is left alone on the last row.
 */
export function Aisles({
  id,
  title,
  categories,
  all,
  t,
}: {
  id: string
  title: string
  categories: readonly CategoryCardView[]
  /** The link beside the head: the shop's own, else every category. */
  all: LinkView
  /** For a tile's count ("24 ürün"), when the shop shows counts. */
  t?: Translate
}) {
  return (
    <section aria-labelledby={id} className="pt-(--section-gap-s)">
      <Container className="flex flex-col gap-6 lg:gap-10">
        <SectionHead id={id} title={title} more={all} />
        <ul
          className={cn(
            "gf-rail -mx-(--gutter) -my-1 grid auto-cols-[44%] grid-flow-col gap-(--gap-columns) overflow-x-auto scroll-px-(--gutter) px-(--gutter) py-1 sm:auto-cols-[30%]",
            "lg:mx-0 lg:my-0 lg:auto-cols-auto lg:grid-flow-row lg:overflow-visible lg:p-0",
            aisleColumns(categories.length)
          )}
        >
          {categories.map((category) => (
            <li key={category.path} className="min-w-0">
              <CategoryTile
                category={category}
                sizes="(min-width: 1280px) 15vw, (min-width: 1024px) 19vw, (min-width: 640px) 30vw, 44vw"
                note={
                  t && typeof category.count === "number"
                    ? t("listing.count", { count: category.count.toLocaleString("tr-TR") })
                    : null
                }
              />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
