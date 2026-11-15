import { Truck } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type {
  FormAction,
  FramedCardView,
  ImageView,
  ProductCardView,
  Translate,
} from "@qticaret/ui"
import { CardBadges, CardRating, isOut, quickAddWords } from "./card-parts"
import { Price } from "./Price"
import { QuickAdd } from "./QuickAdd"
import { Stars } from "./Stars"

/**
 * The photo of a framed card with a second one (`card.css`): with a
 * mouse the second fades in over the first on hover, and on keyboard focus
 * anywhere in the card; on a touch screen the two sit side by side and
 * swipe, a link to the product so a tap still opens it (the eye's
 * duplicate of the name's link: hidden from a screen reader, no tab stop).
 * The second loads lazily, never with the first paint; both fill the
 * well, so nothing shifts.
 */
function Photos({
  first,
  second,
  path,
  sizes,
  priority,
}: {
  first: ImageView
  second: ImageView
  path: string
  sizes: string
  priority: boolean
}) {
  return (
    <>
      <a href={path} tabIndex={-1} aria-hidden="true" className="gf-card-slides">
        <span className="gf-card-slide">
          <ResponsiveImage
            image={first}
            sizes={sizes}
            priority={priority}
            className="h-full w-full object-cover"
          />
        </span>
        <span className="gf-card-slide gf-card-slide--second">
          <ResponsiveImage image={second} sizes={sizes} className="h-full w-full object-cover" />
        </span>
      </a>
      <span className="gf-card-dots" aria-hidden="true">
        <i />
        <i />
      </span>
    </>
  )
}

/**
 * Where the stars stand without a review, when the shop asks for empty ones
 * (E5): the words keep to one line, under the stars on a narrow card.
 */
function NoReviews({ t }: { t: Translate }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-3">
      <Stars rating={0} />
      <span className="whitespace-nowrap">{t("product.card_no_reviews")}</span>
    </p>
  )
}

/** The button across a framed card's foot: in the cart for one variant, else to its page. */
function FootButton({
  product,
  framed,
  t,
  quickAdd,
}: {
  product: ProductCardView
  framed: FramedCardView
  t: Translate
  quickAdd: FormAction | undefined
}) {
  if (!framed.fullButton || isOut(product)) {
    return null
  }
  if (quickAdd && product.quickAdd) {
    return (
      <QuickAdd
        variantId={product.quickAdd.variantId}
        path={product.path}
        action={quickAdd}
        words={quickAddWords(t, product.title)}
        fill
      />
    )
  }
  return (
    <a
      href={product.path}
      className="gf-btn gf-btn--quiet gf-card-btn relative z-(--z-raised) w-full"
      aria-label={t("product.card_options_label", { title: product.title })}
    >
      {t("product.card_options")}
    </a>
  )
}

/**
 * A framed card (UK5, adr/0049 Ek 2026-11-14 §3.3): today's card inside a
 * bordered white box, the photo's well, the pills and the one link over
 * the whole card as ever; under the price "Ücretsiz kargo" when the
 * storefront says it ships free (never on a sold-out card); at its foot
 * the add button across the box ("Sepete ekle" for one variant,
 * "Seçenekler" to its page), or the round "+" on the photo while the shop
 * turns the button off. The second
 * photo, the line, the button and the empty stars are the shop's E5
 * switches, each read by the storefront into the card's `framed`.
 */
export function FramedCard({
  product,
  t,
  quickAdd,
  priority,
  sizes,
}: {
  product: ProductCardView
  t: Translate
  quickAdd: FormAction | undefined
  priority: boolean
  sizes: string
}) {
  const framed = product.framed
  if (!framed) {
    return null
  }
  const out = isOut(product)
  const round = !framed.fullButton && quickAdd && product.quickAdd && !out ? product.quickAdd : null
  const second = product.image ? framed.secondImage : null
  return (
    <article className="group gf-card-framed @container relative flex h-full flex-col gap-3 rounded-tile border border-rule bg-field p-2.5">
      <div className="gf-card-media relative aspect-card overflow-hidden rounded-media bg-paper-2">
        {product.image && second ? (
          <Photos
            first={product.image}
            second={second}
            path={product.path}
            sizes={sizes}
            priority={priority}
          />
        ) : (
          product.image && (
            <ResponsiveImage
              image={product.image}
              sizes={sizes}
              priority={priority}
              className="h-full w-full object-cover"
            />
          )
        )}
        <CardBadges product={product} t={t} />
        {round && quickAdd && (
          <QuickAdd
            variantId={round.variantId}
            path={product.path}
            action={quickAdd}
            words={quickAddWords(t, product.title)}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-0.5">
        {product.brand && <p className="truncate text-xs text-text-3">{product.brand}</p>}
        <h3 className="text-sm leading-snug font-semibold tracking-normal">
          <a
            href={product.path}
            className="line-clamp-2 no-underline underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {product.title}
          </a>
        </h3>
        {product.rating ? (
          <CardRating rating={product.rating} />
        ) : (
          framed.emptyStars && <NoReviews t={t} />
        )}
        {product.price && <Price price={product.price} t={t} className="pt-1" />}
        {framed.freeShipping && !out && (
          <p className="flex items-center gap-1 text-xs font-semibold text-ok">
            <Truck className="size-4 shrink-0" aria-hidden="true" strokeWidth={1.75} />
            {t("product.card_free_shipping")}
          </p>
        )}
      </div>
      <FootButton product={product} framed={framed} t={t} quickAdd={quickAdd} />
    </article>
  )
}
