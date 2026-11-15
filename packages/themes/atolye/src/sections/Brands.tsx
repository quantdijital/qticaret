import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"
import { SectionHead } from "./SectionHead"

/**
 * The shop's brands, each at its page: equal cells in a grid (two, three
 * from 640 px, six from 1024 px), so a row of six fills the width instead
 * of leaving its right half empty (Tezgâh audit K-26); a cell has the
 * button's radius, square where the buttons are.
 */
export function Brands({ section }: { section: Of<"brands"> }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container className="flex flex-col gap-6">
        <SectionHead id={id} title={section.title} />
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {section.brands.map((brand) => (
            <li key={brand.path} className="min-w-0">
              <a
                href={brand.path}
                className="gf-chip flex min-h-12 w-full justify-center rounded-button bg-field px-4 text-md whitespace-normal text-center shadow-[inset_0_0_0_1px_var(--color-rule)]"
              >
                {brand.label}
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
