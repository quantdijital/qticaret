import type { FormAction, Translate } from "@qticaret/ui"
import { Container } from "../components/Container"
import { ProductGrid } from "../components/ProductCard"
import type { Of } from "./plan"
import { SectionHead } from "./SectionHead"
import { ShelfTabs } from "./ShelfTabs"
import { headingId } from "./Opening"

function Rack({
  section,
  t,
  quickAdd,
}: {
  section: Of<"products">
  t: Translate
  quickAdd?: FormAction | undefined
}) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="flex flex-col gap-10">
      <SectionHead id={id} title={section.title} more={section.more} />
      {section.products.length > 0 ? (
        <div className="border-t-2 border-rule-ink pt-6">
          <ProductGrid products={section.products} t={t} columns={3} quickAdd={quickAdd} />
        </div>
      ) : (
        <p className="border-t-2 border-rule-ink pt-4 text-md text-text-2">{section.empty}</p>
      )}
    </section>
  )
}

/**
 * The shelf (design.md § Picks: Raf): the shop's product sections that
 * stand next to each other, one grid each; two or more become tabs, every
 * panel in the HTML. The products are the storefront's cards, in the
 * order the shop's source gives.
 */
export function Shelf({
  sections,
  t,
  quickAdd,
}: {
  sections: readonly Of<"products">[]
  t: Translate
  /** A card's quick add (adr/0046 Ek 2026-11-04). */
  quickAdd?: FormAction | undefined
}) {
  const [first] = sections
  if (!first) {
    return null
  }
  return (
    <div className="pt-(--section-gap)">
      <Container>
        {sections.length === 1 ? (
          <Rack section={first} t={t} quickAdd={quickAdd} />
        ) : (
          <ShelfTabs
            id={headingId(first.id)}
            label={t("home.shelf")}
            tabs={sections.map((section) => section.title)}
          >
            {sections.map((section) => (
              <Rack key={section.id} section={section} t={t} quickAdd={quickAdd} />
            ))}
          </ShelfTabs>
        )}
      </Container>
    </div>
  )
}
