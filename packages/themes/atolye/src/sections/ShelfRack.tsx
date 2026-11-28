import type { ReactNode } from "react"
import { drawnVariant, fieldMark } from "@qticaret/ui"
import type { FormAction, Translate } from "@qticaret/ui"
import { ProductGrid } from "../parts/ProductCard"
import { shelfColumns, shelfCount, shelfPhone } from "../parts/shelf-grid"
import { type Of, headingId } from "./plan"
import { SectionHead } from "./SectionHead"
import { CarouselShelf, ColumnsShelf, CompactShelf, FeaturedShelf } from "./ShelfLayouts"
import { RankedShelf } from "./ShelfRanked"
import { StageShelf } from "./ShelfStage"
import { StripsShelf } from "./ShelfStrips"

/** The rail's variants Atölye draws (adr/0049 Ek 2026-11-15, 2026-11-16); another reads as `grid`. */
const DRAWN = [
  "grid",
  "carousel",
  "featured",
  "compact",
  "columns",
  "strips",
  "ranked",
  "stage_list",
] as const

/** The variant Atölye draws for the rail: its own when drawn here, else a grid. */
export const shelfVariant = (section: Of<"products">) =>
  drawnVariant("products", section.variant, DRAWN)

/**
 * One rail's panel, drawn as its variant: `grid` two rows of the shop's
 * cards-in-a-row (3, 4 or 5; three rows of the shop's two or one on a phone), whole rows
 * only, the rest behind "Tümünü gör"; `carousel`, `featured`, `compact`
 * and `columns` as `ShelfLayouts` draws them, `strips` as `ShelfStrips`, `ranked` as
 * `ShelfRanked`, `stage_list` as `ShelfStage`. In tabs its own head is for
 * the reader only (its pill names it) and its "all products" link stands
 * with its arrows beside the tab row from 1024 px, as a section head's
 * link does, and under the cards as a full-width button below that (owner
 * 2026-11-16); a columns rail's lists carry their own headings, its link
 * under them.
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
  // In tabs the panel's head is for the reader only (its pill names it)
  const title = (
    <h2 id={id} className="sr-only">
      {section.title}
    </h2>
  )
  const more = section.more && (
    <a
      href={section.more.path}
      className="gf-link shrink-0 text-sm lg:text-md"
      {...fieldMark(section.editor, "more")}
    >
      {section.more.label}
    </a>
  )
  // The panel's whole list: beside the tab row from 1024 px, under the cards
  // as a full-width button below that (`tabs.css`)
  const aside = (children: ReactNode) => (
    <div className="gf-tab-aside flex min-h-11 items-center justify-end gap-4">{children}</div>
  )
  const head = tabbed ? (
    title
  ) : (
    <SectionHead
      id={id}
      title={section.title}
      more={section.more}
      marks={section.editor}
      ownMore
      lines={section}
    />
  )
  // A plain panel's link follows its cards in the page's order too; a
  // carousel's stays in its head row beside the arrows (`Scroller`)
  const foot = tabbed && more ? aside(more) : null
  const carouselHead = tabbed
    ? aside(
        <>
          {title}
          {more}
        </>
      )
    : head
  const columns = shelfColumns(section.columns)
  const phone = shelfPhone(section.phoneColumns)
  const empty = section.products.length === 0
  const props = { section, t, quickAdd }
  return (
    <section aria-labelledby={id} className="flex flex-col gap-(--head-gap-s)">
      {empty ? (
        <>
          {head}
          <p className="rounded-media gf-pane p-4 text-text-2">{section.empty}</p>
          {foot}
        </>
      ) : variant === "carousel" ? (
        <CarouselShelf {...props} head={carouselHead} />
      ) : columnsRail ? (
        <ColumnsShelf {...props} />
      ) : (
        <>
          {head}
          {variant === "featured" ? (
            <FeaturedShelf {...props} />
          ) : variant === "compact" ? (
            <CompactShelf {...props} />
          ) : variant === "strips" ? (
            <StripsShelf section={section} t={t} />
          ) : variant === "ranked" ? (
            <RankedShelf {...props} />
          ) : variant === "stage_list" ? (
            <StageShelf {...props} />
          ) : (
            <ProductGrid
              products={section.products.slice(
                0,
                shelfCount(columns, section.products.length, phone)
              )}
              t={t}
              quickAdd={quickAdd}
              columns={columns}
              phone={phone}
            />
          )}
          {foot}
        </>
      )}
      {columnsRail && section.more && (
        <p className="flex justify-center">
          <a
            href={section.more.path}
            className="gf-btn gf-btn--quiet"
            {...fieldMark(section.editor, "more")}
          >
            {section.more.label}
          </a>
        </p>
      )}
    </section>
  )
}
