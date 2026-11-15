import type { ImageView } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"
import { SectionHead } from "./SectionHead"

/**
 * A brand's logo in its cell, standing for its name (the alt text): on a
 * light plate, so the shop's own colours read on any ground (the field it
 * matches on paper, the graphite stage, the shop's colour), every logo the
 * same 36 px tall, its width its own up to the cell's. The plate's height
 * is fixed, so nothing moves when the file arrives.
 */
function BrandLogo({ logo }: { logo: ImageView }) {
  return (
    <span className="flex h-10 max-w-full items-center rounded-inner bg-chip px-2">
      <img
        src={logo.src}
        alt={logo.alt}
        loading="lazy"
        decoding="async"
        className="h-9 w-auto max-w-full object-contain"
      />
    </span>
  )
}

const CELL =
  "gf-chip flex min-h-12 w-full justify-center rounded-button bg-field px-4 text-md whitespace-normal text-center shadow-[inset_0_0_0_1px_var(--color-rule)]"

/**
 * The shop's brands, each at its page: equal cells in a grid (two, three
 * from 640 px, six from 1024 px), so a row of six fills the width instead
 * of leaving its right half empty (Tezgâh audit K-26); a cell has the
 * button's radius, square where the buttons are. A brand with a logo
 * shows it in place of its name, its cell's padding taken in so the
 * plate keeps the cell 48 px tall as a name's; one without, its name.
 */
export function Brands({ section }: { section: Of<"brands"> }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container className="flex flex-col gap-6">
        <SectionHead id={id} title={section.title} marks={section.editor} />
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {section.brands.map((brand) => (
            <li key={brand.path} className="min-w-0">
              <a href={brand.path} className={brand.logo ? `${CELL} py-1` : CELL}>
                {brand.logo ? <BrandLogo logo={brand.logo} /> : brand.label}
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
