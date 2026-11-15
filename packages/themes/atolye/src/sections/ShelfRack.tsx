import { drawnVariant } from "@qticaret/ui"
import type { FormAction, Translate } from "@qticaret/ui"
import { ProductGrid } from "../parts/ProductCard"
import { shelfColumns, shelfCount } from "../parts/shelf-grid"
import { type Of, headingId } from "./plan"
import { SectionHead } from "./SectionHead"
import { CarouselShelf, ColumnsShelf, CompactShelf, FeaturedShelf } from "./ShelfLayouts"

/** The rail's variants Atölye draws (adr/0049 Ek 2026-11-15); another reads as `grid`. */
const DRAWN = ["grid", "carousel", "featured", "compact", "columns"] as const

/** The variant Atölye draws for the rail: its own when drawn here, else a grid. */
export const shelfVariant = (section: Of<"products">) =>
  drawnVariant("products", section.variant, DRAWN)

/**
 * One rail's panel, drawn as its variant: `grid` two rows of the shop's
 * cards-in-a-row (3, 4 or 5; three rows of two on a phone), whole rows
 * only, the rest behind "Tümünü gör"; `carousel`, `featured`, `compact`
 * and `columns` as `ShelfLayouts` draws them. In tabs its own head is for
 * the reader only (its pill names it) and its "all products" link stands
 * with its arrows beside the tab row, as a section head's link does; a
 * columns rail's lists carry their own headings, its link under them.
 */
export function Rack({
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
  const variant = shelfVariant(section)
  const columnsRail = variant === "columns"
  const id = headingId(columnsRail ? (section.lists?.[0]?.id ?? section.id) : section.id)
  const head = tabbed ? (
    // Beside the tab row from 1024 px (`tabs.css`): the panel's whole list, then its arrows
    <div className="gf-tab-aside flex min-h-11 items-center justify-end gap-4">
      <h2 id={id} className="sr-only">
        {section.title}
      </h2>
      {section.more && (
        <a href={section.more.path} className="gf-link shrink-0 text-sm lg:text-md">
          {section.more.label}
        </a>
      )}
    </div>
  ) : (
    <SectionHead id={id} title={section.title} more={section.more} />
  )
  const columns = shelfColumns(section.columns)
  const empty = section.products.length === 0
  const props = { section, t, quickAdd }
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6">
      {empty ? (
        <>
          {head}
          <p className="rounded-media bg-paper-2 p-4 text-text-2">{section.empty}</p>
        </>
      ) : variant === "carousel" ? (
        <CarouselShelf {...props} head={head} />
      ) : columnsRail ? (
        <ColumnsShelf {...props} />
      ) : (
        <>
          {head}
          {variant === "featured" ? (
            <FeaturedShelf {...props} />
          ) : variant === "compact" ? (
            <CompactShelf {...props} />
          ) : (
            <ProductGrid
              products={section.products.slice(0, shelfCount(columns, section.products.length))}
              t={t}
              quickAdd={quickAdd}
              columns={columns}
            />
          )}
        </>
      )}
      {columnsRail && section.more && (
        <p className="flex justify-center">
          <a href={section.more.path} className="gf-btn gf-btn--quiet">
            {section.more.label}
          </a>
        </p>
      )}
    </section>
  )
}
