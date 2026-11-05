import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryCardView, LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { SectionHead } from "./SectionHead"

/** How many categories stand as picture tiles; the rest follow as pills. */
export const TILES = 8

/**
 * The shop's categories as aisles, right under the first screen: up to
 * eight tiles (two across on a phone, four from 1024 px), each the
 * category's picture (the shop's own, else its newest product's photo,
 * chosen by the storefront) with its name on the tile's graphite foot; a
 * category without any picture is its name on the tinted well, the same
 * size. Categories past eight follow as pills, then every category.
 */
export function Aisles({
  id,
  title,
  categories,
  all,
}: {
  id: string
  title: string
  categories: readonly CategoryCardView[]
  all: LinkView
}) {
  const tiles = categories.slice(0, TILES)
  const rest = categories.slice(TILES)
  return (
    <section aria-labelledby={id} className="pt-(--section-gap-s)">
      <Container className="flex flex-col gap-6 lg:gap-10">
        <SectionHead id={id} title={title} more={all} />
        <ul className="grid grid-cols-2 gap-(--gap-columns) lg:grid-cols-4">
          {tiles.map((category) => (
            <li key={category.path} className="min-w-0">
              <a
                href={category.path}
                className={cn(
                  "group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-tile no-underline sm:aspect-[4/3]",
                  category.image
                    ? "gf-stage after:absolute after:inset-0 after:bg-linear-to-t after:from-stage after:from-5% after:via-stage/0 after:via-55% after:to-transparent"
                    : "bg-paper-2 text-text hover:bg-paper-3"
                )}
              >
                {category.image && (
                  <ResponsiveImage
                    image={{ ...category.image, alt: "" }}
                    sizes="(min-width: 1024px) 22vw, 46vw"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <span className="relative z-(--z-raised) px-3 pb-3 text-md leading-tight font-extrabold tracking-[-0.01em] underline-offset-4 group-hover:underline sm:px-4 sm:pb-4 lg:text-title">
                  {category.label}
                </span>
              </a>
            </li>
          ))}
        </ul>
        {rest.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {rest.map((category) => (
              <li key={category.path}>
                <a href={category.path} className="gf-chip">
                  {category.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  )
}
