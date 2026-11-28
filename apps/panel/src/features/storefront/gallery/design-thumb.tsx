import { cn } from "@qticaret/admin-ui/lib/utils"
import type { DesignSummary } from "./api"
import { Block } from "./thumb-blocks"
import type { Shape } from "./thumb-blocks"
import { thumbColors } from "./thumb-colors"

/**
 * A look drawn from its own summary (adr/0064 K1 a), for a look with no
 * picture (a saved one, the draft): its page colour, a header in its main
 * colour, the home page's first sections in their order, each kind its own
 * shape (`thumb-blocks`), and a footer as deep as its sections. Two looks
 * with other colours, sections or order draw apart. Decorative: the card
 * names the look beside it.
 */

// Each home section type's shape; one not listed draws as text
const SHAPES: Record<string, Shape> = {
  hero: "hero",
  hero_slider: "slider",
  featured_product: "hero",
  banner: "banner",
  products: "cards",
  related_products: "cards",
  posts: "cards",
  categories: "tiles",
  brands: "tiles",
  strip_gallery: "tiles",
  departures: "list",
  stats: "figures",
  price_bands: "figures",
  steps: "steps",
  reviews: "quotes",
  testimonials: "quotes",
  trust_badges: "band",
  marquee: "band",
  search_box: "search",
  photo_collage: "collage",
  program: "text",
  faq: "text",
  rich_text: "text",
}

// The sketch has room for this many sections; the rest run off the page as a store's do
const SHOWN = 6

export function DesignThumb({
  summary,
  className,
}: {
  summary: Pick<DesignSummary, "colors" | "sections" | "home_types">
  className?: string | undefined
}) {
  const colors = thumbColors(summary.colors)
  const shapes: Shape[] = summary.home_types.slice(0, SHOWN).map((type) => SHAPES[type] ?? "text")
  const footer = Math.min(summary.sections.footer, 3)
  return (
    <div
      aria-hidden
      data-design-thumb=""
      className={cn(
        "flex aspect-[16/10] w-full flex-col gap-[2.5%] overflow-hidden rounded-md border",
        className
      )}
      style={{ backgroundColor: colors.page }}
    >
      {summary.sections.header > 0 ? (
        <div className="flex shrink-0 items-center gap-[3%] px-[5%] pt-[2.5%]">
          <span className="block size-2 rounded-full" style={{ backgroundColor: colors.primary }} />
          <span
            className="block h-[3px] w-[12%]"
            style={{ backgroundColor: colors.ink, opacity: 0.6 }}
          />
          <span
            className="ml-auto block h-[2px] w-[7%] opacity-40"
            style={{ backgroundColor: colors.ink }}
          />
          <span
            className="block h-[2px] w-[7%] opacity-40"
            style={{ backgroundColor: colors.ink }}
          />
          <span
            className="block h-[2px] w-[7%] opacity-40"
            style={{ backgroundColor: colors.ink }}
          />
          <span
            className="ml-auto block h-2 w-[12%] rounded-full"
            style={{ backgroundColor: colors.primary }}
          />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-[3%] px-[5%]">
        {shapes.length === 0 ? <Block shape="text" colors={colors} /> : null}
        {shapes.map((shape, index) => (
          <Block key={index} shape={shape} colors={colors} />
        ))}
      </div>
      {footer > 0 ? (
        <div
          className="flex shrink-0 items-start gap-[6%] px-[5%] pt-[2%]"
          style={{ height: `${String(6 + footer * 3)}%`, backgroundColor: colors.stage }}
        >
          {Array.from({ length: footer + 1 }, (_, index) => (
            <span key={index} className="block h-[2px] w-[10%] bg-white/40" />
          ))}
        </div>
      ) : null}
    </div>
  )
}
