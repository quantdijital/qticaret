import { cn } from "@qticaret/admin-ui/lib/utils"
import type { DesignSummary } from "./api"
import { thumbColors } from "./thumb-colors"
import type { ThumbColors } from "./thumb-colors"

/**
 * A look drawn from its summary (adr/0064 K1 a): no picture of it is
 * taken, so the card sketches what it holds: the page colour, a header
 * bar with the main colour, the home page's first sections as blocks of
 * their kind, the footer. Decorative: the card names the look beside it.
 */

type Shape = "hero" | "cards" | "tiles" | "strip" | "text"

const SHAPES: Record<string, Shape> = {
  hero: "hero",
  hero_slider: "hero",
  banner: "hero",
  featured_product: "hero",
  products: "cards",
  related_products: "cards",
  posts: "cards",
  categories: "tiles",
  brands: "tiles",
  strip_gallery: "tiles",
  trust_badges: "strip",
  marquee: "strip",
  price_bands: "strip",
  google_rating: "strip",
  stats: "strip",
  steps: "text",
  departures: "strip",
}

// How much of the page each kind takes, as a share of the room
const WEIGHT: Record<Shape, number> = { hero: 5, cards: 4, tiles: 3, strip: 1, text: 2 }
// The sketch has room for this many sections; the rest run off the page as a store's do
const SHOWN = 6

function Block({ shape, colors }: { shape: Shape; colors: ThumbColors }) {
  const grow = { flexGrow: WEIGHT[shape] }
  if (shape === "hero") {
    return (
      <div
        className="flex min-h-0 basis-0 items-end rounded-[3%] p-[3%]"
        style={{ ...grow, backgroundColor: colors.well }}
      >
        <span
          className="block h-[18%] max-h-2 min-h-1 w-[22%] rounded-full"
          style={{ backgroundColor: colors.primary }}
        />
      </div>
    )
  }
  if (shape === "strip") {
    return (
      <div
        className="min-h-[2px] basis-0 rounded-full opacity-60"
        style={{ ...grow, backgroundColor: colors.accent }}
      />
    )
  }
  if (shape === "text") {
    return (
      <div className="flex min-h-0 basis-0 flex-col justify-center gap-[6%]" style={grow}>
        <span className="block h-[2px] w-2/3 opacity-40" style={{ backgroundColor: colors.ink }} />
        <span className="block h-[2px] w-1/2 opacity-25" style={{ backgroundColor: colors.ink }} />
      </div>
    )
  }
  const count = shape === "cards" ? 4 : 3
  return (
    <div className="flex min-h-0 basis-0 gap-[3%]" style={grow}>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="block flex-1 rounded-[6%]"
          style={{ backgroundColor: colors.well }}
        />
      ))}
    </div>
  )
}

export function DesignThumb({
  summary,
  className,
}: {
  summary: Pick<DesignSummary, "colors" | "sections" | "home_types">
  className?: string | undefined
}) {
  const colors = thumbColors(summary.colors)
  const shapes = summary.home_types.slice(0, SHOWN).map((type) => SHAPES[type] ?? "text")
  return (
    <div
      aria-hidden
      data-design-thumb=""
      className={cn(
        "flex aspect-[16/10] w-full flex-col gap-[3%] overflow-hidden rounded-md border",
        className
      )}
      style={{ backgroundColor: colors.page }}
    >
      <div className="flex shrink-0 flex-col">
        <span className="block h-1 w-full" style={{ backgroundColor: colors.stage }} />
        <div className="flex items-center gap-[4%] px-[5%] py-[2.5%]">
          <span
            className="block size-2.5 rounded-full"
            style={{ backgroundColor: colors.primary }}
          />
          <span
            className="block h-[3px] w-[10%] opacity-50"
            style={{ backgroundColor: colors.ink }}
          />
          <span
            className="block h-[3px] w-[8%] opacity-50"
            style={{ backgroundColor: colors.ink }}
          />
          <span
            className="block h-[3px] w-[9%] opacity-50"
            style={{ backgroundColor: colors.ink }}
          />
          <span
            className="ml-auto block h-2 w-[14%] rounded-full"
            style={{ backgroundColor: colors.primary }}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[3%] px-[5%]">
        {shapes.length === 0 ? <Block shape="hero" colors={colors} /> : null}
        {shapes.map((shape, index) => (
          <Block key={index} shape={shape} colors={colors} />
        ))}
      </div>
      {summary.sections.footer > 0 ? (
        <span className="block h-[9%] w-full shrink-0" style={{ backgroundColor: colors.stage }} />
      ) : null}
    </div>
  )
}
