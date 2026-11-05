import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"
import { SectionHead } from "./SectionHead"

/** The shop's brands as large pills, each at its page. */
export function Brands({ section }: { section: Of<"brands"> }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container className="flex flex-col gap-6">
        <SectionHead id={id} title={section.title} />
        <ul className="flex flex-wrap gap-2">
          {section.brands.map((brand) => (
            <li key={brand.path}>
              <a href={brand.path} className="gf-chip min-h-12 px-5 text-md">
                {brand.label}
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
