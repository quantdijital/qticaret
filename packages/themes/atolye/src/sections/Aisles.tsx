import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryCardView, LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
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
}: {
  id: string
  title: string
  categories: readonly CategoryCardView[]
  all: LinkView
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
              <a
                href={category.path}
                className="gf-stage group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-tile no-underline after:absolute after:inset-0 after:bg-linear-to-t after:from-stage after:from-5% after:via-stage/0 after:via-55% after:to-transparent"
              >
                {category.image && (
                  <ResponsiveImage
                    image={{ ...category.image, alt: "" }}
                    sizes="(min-width: 1280px) 15vw, (min-width: 1024px) 19vw, (min-width: 640px) 30vw, 44vw"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <span className="relative z-(--z-raised) px-3 pb-3 text-md leading-tight font-extrabold tracking-[-0.01em] text-balance underline-offset-4 group-hover:underline sm:px-4 sm:pb-4">
                  {category.label}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
