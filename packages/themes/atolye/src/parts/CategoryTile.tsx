import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryCardView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * One category as a picture tile (owner 2026-11-05: categories are always
 * picture tiles, never chips): a 4:5 graphite tile, the category's
 * picture (the shop's own, else its newest product's photo, chosen by
 * the storefront) merging into the graphite at its foot, the name on
 * the foot in 800. A category with no picture at all is its name on the
 * same graphite tile. The whole tile is one link; its picture is
 * decoration, the name says what it is.
 */
export function CategoryTile({
  category,
  sizes,
  compact = false,
}: {
  category: CategoryCardView
  /** How wide the tile shows at each viewport, for the picture's `sizes`. */
  sizes: string
  /** A smaller name, for the rows above a listing's grid. */
  compact?: boolean
}) {
  return (
    <a
      href={category.path}
      className="gf-stage group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-tile no-underline after:absolute after:inset-0 after:bg-linear-to-t after:from-stage after:from-5% after:via-stage/0 after:via-55% after:to-transparent"
    >
      {category.image && (
        <ResponsiveImage
          image={{ ...category.image, alt: "" }}
          sizes={sizes}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <span
        className={cn(
          "relative z-(--z-raised) leading-tight font-extrabold tracking-[-0.01em] text-balance underline-offset-4 group-hover:underline",
          compact ? "px-3 pb-3 text-sm" : "px-3 pb-3 text-md sm:px-4 sm:pb-4"
        )}
      >
        {category.label}
      </span>
    </a>
  )
}
