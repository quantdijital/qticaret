import { SHELF_STAGE_DEFAULTS } from "@qticaret/types/section-shelf"
import { ResponsiveImage } from "@qticaret/ui"
import type { FormAction, ProductCardView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { CardBadges, badgesOf, isOut, quickAddWords } from "../parts/card-parts"
import { CardPriceRow, CardStars, shownOf } from "../parts/card-rows"
import { Price } from "../parts/Price"
import { QuickAdd } from "../parts/QuickAdd"
import { ShelfStageFollow } from "./ShelfStageFollow"
import type { Of } from "./plan"

/**
 * The stage's photo (`shelf-stage.css`): three fifths of the stage, the
 * stage seven twelfths of the container from 1024 px; three fifths of the
 * page's width from 768 px, the page's width on a phone.
 */
const STAGE_SIZES =
  "(min-width: 1440px) 440px, (min-width: 1024px) 31vw, (min-width: 768px) 56vw, 90vw"
/** A row's photo: 56 to 80 px by the rows' count (`shelf-stage.css`), 80 px at most. */
const ROW_SIZES = "80px"

/**
 * The stage's price: large, as the close-up's; a sold-out product the shop
 * shows no price for says what the card says in its place.
 */
function StagePrice({ product, t }: { product: ProductCardView; t: Translate }) {
  if (isOut(product) && shownOf(product).soldOutRow !== "price") {
    return <CardPriceRow product={product} t={t} />
  }
  return product.price ? (
    <Price price={product.price} t={t} size="large" className="[&_s]:text-text-2" />
  ) : null
}

/** The stage's one action: the quick add for one variant, else its page's options; none when sold out. */
function StageAction({
  product,
  t,
  quickAdd,
}: {
  product: ProductCardView
  t: Translate
  quickAdd: FormAction | undefined
}) {
  if (isOut(product)) {
    return null
  }
  if (quickAdd && product.quickAdd) {
    return (
      <QuickAdd
        variantId={product.quickAdd.variantId}
        path={product.path}
        action={quickAdd}
        words={quickAddWords(t, product.title)}
        wide
      />
    )
  }
  return (
    <a
      href={product.path}
      className="gf-btn relative z-(--z-raised) self-start"
      aria-label={t("product.card_options_label", { title: product.title })}
    >
      {t("product.card_options")}
    </a>
  )
}

/**
 * One product on the stage: its photograph filling the stage's height
 * (`object-cover`, the shop's ratio its least height), its pills, brand,
 * name, stars, price large and one action. The name's link covers the
 * panel, the action sits above it. Only the first is shown in the HTML;
 * the others wait `hidden` (their photographs not loaded) until the list
 * calls them.
 */
function StagePanel({
  product,
  at,
  t,
  quickAdd,
}: {
  product: ProductCardView
  at: number
  t: Translate
  quickAdd: FormAction | undefined
}) {
  return (
    <article className="gf-stage-panel group relative" data-stage={at} hidden={at !== 0}>
      <div className="gf-stage-photo relative overflow-hidden rounded-media bg-media">
        {product.image && (
          <ResponsiveImage
            image={product.image}
            sizes={STAGE_SIZES}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <CardBadges product={product} t={t} />
      </div>
      <div className="flex min-w-0 flex-col justify-end gap-2 p-1 md:py-2">
        {product.brand && <p className="truncate text-sm text-text-2">{product.brand}</p>}
        <h3 className="text-title leading-tight font-extrabold tracking-(--tracking-head) md:text-section">
          <a
            href={product.path}
            className="line-clamp-4 no-underline underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {product.title}
          </a>
        </h3>
        <CardStars product={product} t={t} />
        <StagePrice product={product} t={t} />
        <div className="pt-2">
          <StageAction product={product} t={t} quickAdd={quickAdd} />
        </div>
      </div>
    </article>
  )
}

/** A row's one pill on its photo, as the compact card's: "Tükendi" over a discount. */
function RowPill({ product, t }: { product: ProductCardView; t: Translate }) {
  const badges = badgesOf(product)
  const out = isOut(product) && badges.soldOut
  const discount = badges.sale ? (product.price?.discount ?? null) : null
  if (!out && discount === null) {
    return null
  }
  return (
    <p className="gf-stage-pill" data-tone={out ? "out" : "deal"}>
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

/** One row of the list: a small photo, the name on two lines, the price; the whole row one link. */
function StageRow({ product, t }: { product: ProductCardView; t: Translate }) {
  return (
    <article className="gf-stage-row group relative">
      <div className="gf-stage-thumb relative shrink-0 overflow-hidden rounded-media bg-media">
        {product.image && (
          <ResponsiveImage
            image={product.image}
            sizes={ROW_SIZES}
            className="h-full w-full object-cover"
          />
        )}
        <RowPill product={product} t={t} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-sm leading-snug font-semibold tracking-normal lg:text-md">
          <a
            href={product.path}
            className="line-clamp-2 no-underline underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {product.title}
          </a>
        </h3>
        <CardPriceRow product={product} t={t} />
      </div>
    </article>
  )
}

/**
 * `stage_list` (adr/0049 Ek 2026-11-16): one product large on a stage
 * (the graphite stage or the light well) beside a list of the rail's.
 * Following the list (the default), every product is listed and the row
 * under the pointer or the keyboard's focus takes the stage from 1024 px
 * (`ShelfStageFollow`, the page's one small island); before the script,
 * on a phone and on a touch screen the first stays, its row marked (a
 * phone hides that row: the stage stands right above it). Not following,
 * the first takes the stage and the rest are listed, nothing moves. Each
 * row is one link to its product; the stage carries the add button.
 */
export function StageShelf({
  section,
  t,
  quickAdd,
}: {
  section: Of<"products">
  t: Translate
  quickAdd?: FormAction | undefined
}) {
  const settings = section.stage ?? SHELF_STAGE_DEFAULTS
  const follow = settings.stage_follow === "on"
  const staged = follow ? section.products : section.products.slice(0, 1)
  const listed = follow ? section.products : section.products.slice(1)
  return (
    <div
      className="gf-stage-list"
      data-side={settings.stage_side}
      data-ground={settings.stage_ground}
      data-follow={settings.stage_follow}
      data-rows={listed.length}
    >
      {follow && listed.length > 1 && <ShelfStageFollow />}
      {/* On graphite the stage's own buttons, focus ring and sale red (`gf-stage`) */}
      <div
        className={cn("gf-stage-box rounded-tile", settings.stage_ground === "stage" && "gf-stage")}
      >
        {staged.map((product, at) => (
          <StagePanel key={product.id} product={product} at={at} t={t} quickAdd={quickAdd} />
        ))}
      </div>
      {listed.length > 0 && (
        <ul className="gf-stage-rows">
          {listed.map((product, at) => (
            <li
              key={product.id}
              data-pick={follow ? at : undefined}
              data-on={follow && at === 0 ? "" : undefined}
            >
              <StageRow product={product} t={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
