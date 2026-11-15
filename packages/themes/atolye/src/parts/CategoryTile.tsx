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
 * decoration, the name says what it is. `note` (a count, "24 ürün") sits
 * under the name, quieter.
 */
export function CategoryTile({
  category,
  sizes,
  compact = false,
  note,
}: {
  category: CategoryCardView
  /** How wide the tile shows at each viewport, for the picture's `sizes`. */
  sizes: string
  /** A smaller name, for the rows above a listing's grid. */
  compact?: boolean
  /** A quiet line under the name ("24 ürün"). */
  note?: string | null | undefined
}) {
  return (
    <a
      href={category.path}
      className={cn(
        "gf-stage group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-tile no-underline after:absolute after:inset-0 after:bg-linear-to-t after:from-stage after:via-stage/0 after:to-transparent",
        // A count under the name lifts the text: the graphite foot reaches higher
        note ? "after:from-15% after:via-65%" : "after:from-5% after:via-55%",
        compact && "gf-subtile"
      )}
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
          "relative z-(--z-raised) flex flex-col gap-0.5",
          compact ? "px-3 pb-3" : "px-3 pb-3 sm:px-4 sm:pb-4"
        )}
      >
        <span
          className={cn(
            "leading-tight font-extrabold tracking-[-0.01em] text-balance underline-offset-4 group-hover:underline",
            compact ? "text-sm" : "text-md"
          )}
        >
          {category.label}
        </span>
        {note && <span className="text-xs font-semibold text-stage-text-2">{note}</span>}
      </span>
    </a>
  )
}
