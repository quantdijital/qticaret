import type { ReactNode } from "react"
import { SHELF_LIMITS } from "@qticaret/types/section-shelf"
import { scrollerSettingsOf } from "@qticaret/types/section-scroller"
import { fieldKey, fieldMark } from "@qticaret/ui"
import type { FormAction, ProductCardView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { CompactCard } from "../parts/CompactCard"
import { ProductCard } from "../parts/ProductCard"
import { Scroller } from "../parts/Scroller"
import { scrollerSizes } from "../parts/scroller-sizes"
import { type Of, headingId } from "./plan"

type Shelf = Of<"products">

interface LayoutProps {
  section: Shelf
  t: Translate
  quickAdd?: FormAction | undefined
}

/** The scroller's words for a row named `label`. */
const scrollerWords = (t: Translate, label: string) => ({
  label,
  previous: t("scroller.previous"),
  next: t("scroller.next"),
  play: t("scroller.play"),
  pause: t("scroller.pause"),
  page: t("scroller.page", { n: "{n}" }),
  pages: t("scroller.pages"),
})

/**
 * `carousel`: one row of the rail's cards, as the rail's or the theme
 * setting's card, sliding with the scroller kit; its head beside the
 * arrows when they stand there. Every photo loads lazily.
 */
export function CarouselShelf({ section, t, quickAdd, head }: LayoutProps & { head: ReactNode }) {
  const settings = scrollerSettingsOf(section.scroller)
  const sizes = scrollerSizes(settings)
  return (
    <Scroller settings={settings} words={scrollerWords(t, section.title)} head={head}>
      {section.products.map((product) => (
        <ProductCard key={product.id} product={product} t={t} quickAdd={quickAdd} sizes={sizes} />
      ))}
    </Scroller>
  )
}

/** The large card's photo: the left two fifths from 1024 px, the page's width below. */
const LEAD_SIZES = "(min-width: 1440px) 540px, (min-width: 1024px) 38vw, 92vw"
/** A small card's photo: three across in the right three fifths from 1024 px, two below. */
const SMALL_SIZES = "(min-width: 1440px) 250px, (min-width: 1024px) 18vw, 46vw"

/**
 * `featured`: the rail's first product as one large card (its photo, name,
 * stars, price and add button), beside it two rows of three small ones
 * (the rail's or the theme setting's card); on a phone the large card on
 * top and the small ones two across under it.
 */
export function FeaturedShelf({ section, t, quickAdd }: LayoutProps) {
  const [lead, ...rest] = section.products.slice(0, SHELF_LIMITS.featured)
  if (!lead) {
    return null
  }
  return (
    <div className="grid gap-x-(--gap-columns) gap-y-(--gap-rows-s) lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="gf-card-lead min-w-0">
        <ProductCard product={lead} t={t} quickAdd={quickAdd} sizes={LEAD_SIZES} />
      </div>
      {rest.length > 0 && (
        <ul className="grid grid-cols-[repeat(2,minmax(0,1fr))] content-start gap-x-(--gap-columns) gap-y-(--gap-rows-s) md:grid-cols-[repeat(3,minmax(0,1fr))]">
          {rest.map((product) => (
            <li key={product.id} className="min-w-0">
              <ProductCard product={product} t={t} quickAdd={quickAdd} sizes={SMALL_SIZES} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Compact cards one under another, the list's own column (`columns`) or a grid's cell. */
function CompactList({
  products,
  t,
  className,
}: {
  products: readonly ProductCardView[]
  t: Translate
  className?: string
}) {
  return (
    <ul className={cn("grid gap-x-(--gap-columns) gap-y-4", className)}>
      {products.map((product) => (
        <li key={product.id} className="min-w-0">
          <CompactCard product={product} t={t} />
        </li>
      ))}
    </ul>
  )
}

/** `compact`: small side-by-side cards three across from 1024 px (two from 768), one a row on a phone. */
export function CompactShelf({ section, t }: LayoutProps) {
  return (
    <CompactList
      products={section.products}
      t={t}
      className="md:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]"
    />
  )
}

/**
 * `columns`: two or three lists side by side from 1024 px (two from 768,
 * one under another on a phone), each its own heading and compact cards.
 */
/** A columns list's title as the editor's field key: the rail's own, then its more lists'. */
const listKey = (at: number) => (at === 0 ? "title" : fieldKey("lists", at - 1, "title"))

export function ColumnsShelf({ section, t }: LayoutProps) {
  const lists = section.lists ?? []
  return (
    <div
      className={cn(
        "grid gap-x-(--gap-columns) gap-y-10 md:grid-cols-[repeat(2,minmax(0,1fr))]",
        lists.length > 2 && "lg:grid-cols-[repeat(3,minmax(0,1fr))]"
      )}
    >
      {lists.map((list, drawn) => (
        <section key={list.id} aria-labelledby={headingId(list.id)} className="flex flex-col gap-5">
          <h2 id={headingId(list.id)} {...fieldMark(section.editor, listKey(list.at ?? drawn))}>
            {list.title}
          </h2>
          <CompactList products={list.products} t={t} />
        </section>
      ))}
    </div>
  )
}
