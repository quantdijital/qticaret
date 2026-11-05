import type { CategoryCardView, LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../components/Container"
import { CategoryTiles, tileShapeOf, tilesOf } from "./CategoryTile"

/** The ruled rows: names in the display face, each one link, every category's page last. */
function IndexRows({
  categories,
  all,
  skipOnPhone,
  className,
}: {
  categories: readonly { category: LinkView; index: number }[]
  all: LinkView
  skipOnPhone: number
  className?: string
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-x-(--gap-columns) border-t-2 border-rule-ink sm:grid-cols-2",
        className
      )}
    >
      {categories.map(({ category, index }) => (
        <li
          key={category.path}
          className={cn("border-b border-rule", index < skipOnPhone && "max-lg:hidden")}
        >
          <a
            href={category.path}
            className="at-row-link flex min-h-11 items-center py-2 text-lg font-medium lg:min-h-18 lg:py-3 lg:font-display lg:text-tile lg:leading-[1.08] lg:font-normal lg:tracking-(--tracking-display)"
          >
            {category.label}
          </a>
        </li>
      ))}
      {/* Every category, as the index's last row: no name stands alone on it */}
      <li className="border-b border-rule">
        <a href={all.path} className="at-link min-h-11 py-2 lg:min-h-18">
          {all.label}
        </a>
      </li>
    </ul>
  )
}

/**
 * The shop's categories section on a sand band (design.md § Category
 * card; Loom's ruled rows): an ink rule, then the names in the display
 * face at 32 px in up to three columns, each row one link, and the page
 * of every category as the last row. Under 1024 px the first ones are
 * already in the opening, so they are left out here (`skipOnPhone`), and
 * with nothing else to show the section stays off a phone.
 *
 * Categories with a picture (adr/0046 Ek 2026-11-04) come first as the
 * tiles: square photographs with the name beneath in the rows' own voice
 * (no type on a photograph), five a bento with a lead, three or four a
 * row (`tilesOf`, `CategoryTiles`), and under 1024 px only those the
 * opening does not name. One or two pictured stand beside the rows
 * instead. The rest keep their ruled rows, so a category without a
 * picture reads as an entry of the index, never as an empty frame.
 */
export function CategoryIndex({
  id,
  title,
  categories,
  all,
  skipOnPhone = 0,
}: {
  id: string
  title: string
  categories: readonly CategoryCardView[]
  all: LinkView
  skipOnPhone?: number
}) {
  const tiles = tilesOf(categories)
  const tiled = new Set(tiles.map((tile) => tile.category.path))
  const rows = categories
    .map((category, index) => ({ category, index }))
    .filter(({ category }) => !tiled.has(category.path))
  // Every name is in the opening already (tiles included): nothing for a phone here
  const offPhone = skipOnPhone > 0 && categories.length <= skipOnPhone
  const beside = tiles.length > 0 && tileShapeOf(tiles.length) === "beside"
  return (
    <section
      aria-labelledby={id}
      className={cn("bg-paper-2 py-(--section-gap-s)", offPhone && "max-lg:hidden")}
    >
      <Container
        className={cn(
          "flex flex-col gap-6",
          beside && "lg:grid lg:grid-cols-12 lg:gap-x-(--gap-columns)"
        )}
      >
        <h2 id={id} className={beside ? "lg:col-span-12" : undefined}>
          {title}
        </h2>
        {tiles.length > 0 && <CategoryTiles tiles={tiles} skipOnPhone={skipOnPhone} />}
        <IndexRows
          categories={rows}
          all={all}
          skipOnPhone={skipOnPhone}
          className={beside ? "lg:col-span-7 lg:self-start" : "xl:grid-cols-3"}
        />
      </Container>
    </section>
  )
}
