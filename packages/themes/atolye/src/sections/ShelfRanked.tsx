import { shelfRankedLayoutOf } from "@qticaret/types/section-shelf"
import { ResponsiveImage } from "@qticaret/ui"
import type { FormAction, ProductCardView, Translate } from "@qticaret/ui"
import { badgesOf, isOut, quickAddWords } from "../parts/card-parts"
import { CardQuickView } from "../parts/card-quick-view"
import { CardPriceRow, CardStars } from "../parts/card-rows"
import { QuickAdd } from "../parts/QuickAdd"
import type { Of } from "./plan"

/**
 * How large a place stands (`ranked.css`): `lead` the first of a "lead"
 * rail, large at every width; `row` a "row" rail's, large from 1024 px and
 * a row of the list below; `line` always a row of the list.
 */
type Size = "lead" | "row" | "line"

/** Each size's photograph widths, for its `sizes` (the container stops at 1440 px). */
const SIZES: Readonly<Record<Size, string>> = {
  lead: "(min-width: 1440px) 440px, (min-width: 768px) 34vw, 78vw",
  row: "(min-width: 1440px) 320px, (min-width: 1024px) 23vw, (min-width: 768px) 96px, 72px",
  line: "(min-width: 768px) 96px, 72px",
}

/**
 * One pill on the photograph, as the compact card's: "Tükendi" over a
 * discount, each as the shop shows it ("%30", the reader hears "%30 indirim").
 */
function Pill({ product, t }: { product: ProductCardView; t: Translate }) {
  const badges = badgesOf(product)
  const out = isOut(product) && badges.soldOut
  const discount = badges.sale ? (product.price?.discount ?? null) : null
  if (!out && discount === null) {
    return null
  }
  return (
    <p className="gf-rank-pill" data-tone={out ? "out" : "deal"}>
      {out ? (
        t("product.out_of_stock")
      ) : (
        <>
          <span aria-hidden="true">{t("product.discount_short", { percent: discount ?? 0 })}</span>
          <span className="sr-only">{t("product.discount", { percent: discount ?? 0 })}</span>
        </>
      )}
    </p>
  )
}

/**
 * One place: its figure large beside the photograph (for the eye only:
 * the list and the heading's hidden "1." say it), the brand, the name as
 * the one link over the whole of it, the stars, the price as every card's
 * (the storefront's, a wholesaler's too), and the card's own actions.
 */
function Place({
  product,
  place,
  size,
  t,
  quickAdd,
}: {
  product: ProductCardView
  place: number
  size: Size
  t: Translate
  quickAdd?: FormAction | undefined
}) {
  const add = quickAdd && product.quickAdd && !isOut(product) ? product.quickAdd : null
  return (
    <li className="gf-rank" data-size={size} data-wide={place > 9 ? "" : undefined}>
      <article className="group gf-card gf-rank-card @container">
        <span className="gf-rank-n" aria-hidden="true">
          {place}
        </span>
        <div className="gf-rank-photo">
          {product.image && (
            <ResponsiveImage
              image={product.image}
              sizes={SIZES[size]}
              className="h-full w-full object-cover"
            />
          )}
          <Pill product={product} t={t} />
        </div>
        <div className="gf-rank-text">
          {product.brand && <p className="gf-rank-brand">{product.brand}</p>}
          <h3 className="gf-rank-title">
            <span className="sr-only">{t("home.rank_place", { n: place })} </span>
            <a
              href={product.path}
              className="line-clamp-2 no-underline underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
            >
              {product.title}
            </a>
          </h3>
          <CardStars product={product} t={t} />
          <CardPriceRow product={product} t={t} />
        </div>
        {(Boolean(product.quickView) || add !== null) && (
          <div className="gf-rank-acts">
            <CardQuickView product={product} t={t} inline />
            {add && quickAdd && (
              <QuickAdd
                variantId={add.variantId}
                path={product.path}
                action={quickAdd}
                words={quickAddWords(t, product.title)}
                inline
              />
            )}
          </div>
        )}
      </article>
    </li>
  )
}

/**
 * `ranked` (adr/0049 Ek 2026-11-16): the rail's products as a ranked list
 * in their source's order (a best-seller rail's, by sales), each beside
 * its place in large figures, one ordered list. `lead`: the first large on
 * the left, the rest in rows beside it (two columns of rows past six from
 * 1280 px; on a phone the first on top); `row`: all large in one row from
 * 1024 px (two past five), a list below. The card's actions stay: quick
 * view and the quick add as icons beside each place.
 */
export function RankedShelf({
  section,
  t,
  quickAdd,
}: {
  section: Of<"products">
  t: Translate
  quickAdd?: FormAction | undefined
}) {
  const layout = shelfRankedLayoutOf(section.rankedLayout)
  return (
    // An unstyled list loses its role in WebKit: said again, so a reader still counts the places
    <ol role="list" className="gf-ranked" data-layout={layout} data-count={section.products.length}>
      {section.products.map((product, index) => (
        <Place
          key={product.id}
          product={product}
          place={index + 1}
          size={layout === "row" ? "row" : index === 0 ? "lead" : "line"}
          t={t}
          quickAdd={quickAdd}
        />
      ))}
    </ol>
  )
}
