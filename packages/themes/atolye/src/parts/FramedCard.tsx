import { Truck } from "lucide-react"
import type { FormAction, FramedCardView, ProductCardView, Translate } from "@qticaret/ui"
import { CardBadges, isOut, quickAddWords } from "./card-parts"
import { CardPriceRow, CardStars } from "./card-rows"
import { cardButtonClass } from "./card-button"
import { CardQuickView } from "./card-quick-view"
import { CardPhoto } from "./CardPhoto"
import { QuickAdd } from "./QuickAdd"

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
        fill={framed.buttonStyle}
      />
    )
  }
  return (
    <a
      href={product.path}
      className={`${cardButtonClass(framed.buttonStyle)} relative z-(--z-raised) w-full`}
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
 * turns the button off, in the look the shop chose (`buttonStyle`). The
 * line and the button are the shop's E5 switches, each read by the
 * storefront into the card's `framed`; the second photo, the pills and the
 * rows every card's (`CardPhoto`; `shown`, adr/0049 Ek 2026-11-15).
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
  return (
    <article className="group gf-card gf-card-framed @container relative flex h-full flex-col gap-3 rounded-tile border border-rule bg-field p-2.5">
      <div className="gf-card-media relative aspect-card overflow-hidden rounded-media bg-media">
        <CardPhoto product={product} sizes={sizes} priority={priority} />
        <CardBadges product={product} t={t} />
        <CardQuickView product={product} t={t} />
        {round && quickAdd && (
          <QuickAdd
            variantId={round.variantId}
            path={product.path}
            action={quickAdd}
            words={quickAddWords(t, product.title)}
          />
        )}
      </div>
      <div className="gf-card-info flex flex-1 flex-col gap-1 px-0.5">
        {product.brand && <p className="truncate text-xs text-text-3">{product.brand}</p>}
        <h3 className="text-sm leading-snug font-semibold tracking-normal">
          <a
            href={product.path}
            className="line-clamp-2 no-underline transition-colors duration-(--dur-micro) group-hover:text-text-2 after:absolute after:inset-0 after:content-['']"
          >
            {product.title}
          </a>
        </h3>
        <CardStars product={product} t={t} />
        <CardPriceRow product={product} t={t} className="pt-1" />
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
