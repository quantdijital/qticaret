import { ResponsiveImage } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"
import { SectionHead } from "./SectionHead"

/** Columns from 1024 px for the shop's two to four bands, written out whole for Tailwind. */
const COLUMNS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
}

/**
 * The price bands (adr/0049 Ek 2026-11-14, note "Katalog ana sayfası";
 * design.md § Fiyat bantları): one card a band, the band's label large in
 * the shop's colour, its line under it and the products picked in it
 * small; the whole card one link to the catalogue filtered by the band's
 * range. On a phone one row that scrolls (70% a card), from 768 px two
 * columns, from 1024 px all side by side. The cards stand on `field`, so
 * a steel-well ground (the section's look) frames them.
 */
export function PriceBands({ section }: { section: Of<"price_bands"> }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="pt-(--section-gap-s)">
      <Container className="flex flex-col gap-6 lg:gap-8">
        <SectionHead id={id} title={section.title} />
        <ul
          className={cn(
            "gf-rail -mx-(--gutter) -my-1 grid auto-cols-[70%] grid-flow-col gap-(--gap-columns) overflow-x-auto scroll-px-(--gutter) px-(--gutter) py-1",
            "md:mx-0 md:my-0 md:auto-cols-auto md:grid-flow-row md:grid-cols-2 md:overflow-visible md:p-0",
            COLUMNS[section.bands.length]
          )}
        >
          {section.bands.map((band) => (
            <li key={band.path} className="min-w-0">
              <a
                href={band.path}
                className="group flex h-full flex-col gap-2 rounded-tile border border-rule bg-field p-5 no-underline transition-colors hover:border-signal lg:p-6"
              >
                <span className="text-display leading-[1.15] font-extrabold tracking-(--tracking-head) text-signal group-hover:underline group-hover:underline-offset-4">
                  {band.label}
                </span>
                {band.text && <span className="text-sm text-text-2">{band.text}</span>}
                {band.products.length > 0 && (
                  <span className="mt-2 flex gap-2">
                    {band.products.map((product) => (
                      <span
                        key={product.path}
                        className="block size-16 shrink-0 overflow-hidden rounded-inner bg-paper-3"
                      >
                        {product.image && (
                          <ResponsiveImage
                            image={{ ...product.image, alt: "" }}
                            sizes="64px"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
