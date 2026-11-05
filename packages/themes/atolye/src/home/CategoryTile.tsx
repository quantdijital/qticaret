import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryCardView, ImageView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** A category the shop gave a picture, and its place in the section. */
export interface Tile {
  category: CategoryCardView & { image: ImageView }
  index: number
}

/**
 * The pictured categories the tiles show, in the shop's order: five (a
 * lead of two by two and four beside it) when there are that many, else
 * the four, three, two or one there are. The rest, pictured or not, keep
 * their ruled rows, so the index the section is stays the index.
 */
export function tilesOf(categories: readonly CategoryCardView[]): Tile[] {
  const pictured = categories.flatMap((category, index) =>
    category.image ? [{ category: { ...category, image: category.image }, index }] : []
  )
  return pictured.slice(0, 5)
}

/** How the tiles stand from 1024 px: a bento with a lead, one row, or beside the ruled rows. */
export type TileShape = "bento" | "row" | "beside"

export const tileShapeOf = (count: number): TileShape =>
  count >= 5 ? "bento" : count >= 3 ? "row" : "beside"

/** The rows' own voice: Hanken on a phone, the display face at 32 px from 1024 px. */
const NAME =
  "text-lg font-medium lg:font-display lg:text-tile lg:leading-[1.08] lg:font-normal lg:tracking-(--tracking-display)"

/**
 * A category as a card (design.md § Category card): the shop's photograph
 * square in a sand well, never filtered, the name beneath it in the same
 * voice as the index's rows (no type on a photograph); the whole card one
 * link, named by its name, and on hover the name is underlined. The
 * bento's lead fills its two rows from 1024 px (`fill`).
 */
function CategoryTile({ tile, fill, sizes }: { tile: Tile; fill: boolean; sizes: string }) {
  return (
    <a href={tile.category.path} className="at-tile flex h-full flex-col gap-3">
      <span
        className={cn(
          "relative block overflow-hidden bg-paper-3",
          fill ? "aspect-square lg:aspect-auto lg:min-h-0 lg:flex-1" : "aspect-square"
        )}
      >
        <ResponsiveImage
          // The name beside it says what it shows
          image={{ ...tile.category.image, alt: "" }}
          sizes={sizes}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
      <span className={NAME}>{tile.category.label}</span>
    </a>
  )
}

/**
 * The pictured categories (adr/0046 Ek 2026-11-04). From 1024 px five
 * stand as a bento four across, the first a lead of two by two; three or
 * four as one row; one or two beside the ruled rows (`CategoryIndex`).
 * Under 1024 px the opening already names the first categories, so their
 * tiles stay away there (`skipOnPhone`); the others stand two across, an
 * odd count's first one the whole width.
 */
export function CategoryTiles({
  tiles,
  skipOnPhone,
}: {
  tiles: readonly Tile[]
  skipOnPhone: number
}) {
  const shape = tileShapeOf(tiles.length)
  const narrow = tiles.filter((tile) => tile.index >= skipOnPhone)
  const wide = narrow.length % 2 === 1 ? narrow[0] : undefined
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-8 border-t-2 border-rule-ink pt-6 lg:gap-x-(--gap-columns) lg:gap-y-10",
        narrow.length === 0 && "max-lg:hidden",
        shape === "bento" && "lg:grid-cols-4",
        shape === "row" && (tiles.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"),
        shape === "beside" && "lg:col-span-5"
      )}
    >
      {tiles.map((tile, position) => {
        const lead = position === 0 && shape === "bento"
        const whole = tile === wide
        return (
          <li
            key={tile.category.path}
            className={cn(
              tile.index < skipOnPhone && "max-lg:hidden",
              whole && "max-lg:col-span-2",
              lead && "lg:col-span-2 lg:row-span-2",
              shape === "beside" && tiles.length === 1 && "lg:col-span-2"
            )}
          >
            <CategoryTile
              tile={tile}
              fill={lead}
              sizes={[
                lead
                  ? "(min-width: 1440px) 640px, (min-width: 1024px) 48vw"
                  : shape === "beside"
                    ? "(min-width: 1440px) 260px, (min-width: 1024px) 19vw"
                    : "(min-width: 1440px) 416px, (min-width: 1024px) 31vw",
                whole ? "100vw" : "50vw",
              ].join(", ")}
            />
          </li>
        )
      })}
    </ul>
  )
}
