import type { FormAction, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { ProductGrid } from "../parts/ProductCard"
import { shelfColumns, shelfCount } from "../parts/shelf-grid"
import { type Of, headingId } from "./plan"
import { SectionHead } from "./SectionHead"
import { ShelfTabs } from "./ShelfTabs"

/**
 * One section's panel: two rows of the shop's cards-in-a-row (3, 4 or 5;
 * three rows of two on a phone), whole rows only; the rest behind
 * "Tümünü gör".
 */
function Rack({
  section,
  t,
  quickAdd,
  tabbed,
}: {
  section: Of<"products">
  t: Translate
  quickAdd?: FormAction | undefined
  tabbed: boolean
}) {
  const id = headingId(section.id)
  const columns = shelfColumns(section.columns)
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6">
      {tabbed ? (
        <h2 id={id} className="sr-only">
          {section.title}
        </h2>
      ) : (
        <SectionHead id={id} title={section.title} more={section.more} />
      )}
      {section.products.length > 0 ? (
        <ProductGrid
          products={section.products.slice(0, shelfCount(columns, section.products.length))}
          t={t}
          quickAdd={quickAdd}
          columns={columns}
        />
      ) : (
        <p className="rounded-media bg-paper-2 p-4 text-text-2">{section.empty}</p>
      )}
      {tabbed && section.more && (
        <p className="flex justify-center">
          <a href={section.more.path} className="gf-btn gf-btn--quiet">
            {section.more.label}
          </a>
        </p>
      )}
    </section>
  )
}

/**
 * The shelf: the shop's product sections that stand next to each other,
 * each in its own cards-in-a-row; two or more become tabs (pills), every
 * panel in the HTML. In tabs each panel's own head is for the reader only
 * (its pill names it) and its "all products" link sits under its grid.
 */
export function Shelf({
  sections,
  t,
  quickAdd,
}: {
  sections: readonly Of<"products">[]
  t: Translate
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
          <Rack section={first} t={t} quickAdd={quickAdd} tabbed={false} />
        ) : (
          <ShelfTabs
            id={headingId(first.id)}
            label={t("home.shelf")}
            tabs={sections.map((section) => section.title)}
          >
            {sections.map((section) => (
              <Rack key={section.id} section={section} t={t} quickAdd={quickAdd} tabbed />
            ))}
          </ShelfTabs>
        )}
      </Container>
    </div>
  )
}
