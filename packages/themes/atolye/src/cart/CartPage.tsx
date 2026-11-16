import { BadgePercent, ShoppingBag, Truck } from "lucide-react"
import type { CartPageView, ThemeActions, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { FreeShippingMeter } from "../parts/FreeShippingMeter"
import { CartLine } from "./CartLine"
import { CartSummary } from "./CartSummary"
import { Upsell } from "./Upsell"

/** A note over the lines: an error in the error's colour, anything else plain. */
function Note({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <p
      role={error ? "alert" : "note"}
      className={cn(
        "rounded-media p-4 text-sm font-semibold",
        error ? "gf-pane text-error" : "gf-pane text-text"
      )}
    >
      {text}
    </p>
  )
}

/** A payment link's cart (adr/0051): the note, and the way out for a shopper who wants to shop anew. */
function LockedNote({ note, view, t, actions }: Page) {
  return (
    <div role="note" className="flex flex-col gap-3 rounded-media gf-box p-4 text-sm">
      <p className="font-semibold">{note}</p>
      {actions.leaveLinkCart && view.locked && (
        <form action={actions.leaveLinkCart}>
          <button type="submit" className="gf-link min-h-11 text-left">
            {t("cart.payment_link_leave")}
          </button>
        </form>
      )}
    </div>
  )
}

interface Page {
  note: string
  view: CartPageView
  t: Translate
  actions: ThemeActions
}

/** No lines yet: the empty well, the way back to the shop, then what sells. */
function EmptyCart({ view, t, actions }: Omit<Page, "note">) {
  return (
    <Container className="flex flex-col gap-(--section-gap) pt-8 lg:pt-12">
      <div className="flex flex-col gap-6">
        <h1>{t("cart.title")}</h1>
        {view.error && <Note text={view.error} error />}
        <div className="flex flex-col items-start gap-5 rounded-tile gf-box p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-pill gf-shape bg-paper">
            <ShoppingBag className="size-6" aria-hidden="true" strokeWidth={1.75} />
          </span>
          <p className="flex-1 text-lg font-semibold">{t("cart.empty")}</p>
          <a href="/" className="gf-btn">
            {t("cart.continue")}
          </a>
        </div>
      </div>
      {view.upsell && (
        <Upsell
          title={view.upsell.title}
          products={view.upsell.products}
          t={t}
          quickAdd={actions.addToCart}
        />
      )}
    </Container>
  )
}

/**
 * The cart (`/sepet`): its head and count, free shipping's distance as
 * the first well, the shop's cart offers, the lines large (quantity pill,
 * bin, struck price), the totals in a well that stays in sight on a
 * desktop with the codes and the backend's shipping estimate, the shop's
 * promises under it, then products to add. On a phone a bar holds the
 * subtotal and "Ödemeye geç" in the thumb's reach above the bottom bar.
 */
export function CartPage({
  view,
  t,
  actions,
}: {
  view: CartPageView
  t: Translate
  actions: ThemeActions
}) {
  if (view.lines.length === 0) {
    return <EmptyCart view={view} t={t} actions={actions} />
  }
  const count = view.lines.reduce((sum, line) => sum + line.quantity, 0)
  const locked = Boolean(view.locked)
  const offers = view.offers ?? []
  return (
    <Container className="flex flex-col gap-(--section-gap) pt-8 lg:pt-12">
      <div className="flex flex-col gap-6 lg:gap-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1>{t("cart.title")}</h1>
          <p className="tabular text-md text-text-2">{t("cart.item_count", { count })}</p>
        </div>
        {view.error && <Note text={view.error} error />}
        {view.giftNotice && <Note text={view.giftNotice} />}
        {view.locked && <LockedNote note={view.locked} view={view} t={t} actions={actions} />}
        <div className="grid items-start gap-(--gap-columns) lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
          <div className="flex min-w-0 flex-col gap-3">
            {view.freeShipping && (
              <div className="flex items-center gap-4 rounded-tile gf-box p-4 sm:p-5">
                <Truck
                  className="size-6 shrink-0 text-text-2"
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <FreeShippingMeter view={view.freeShipping} />
                </div>
              </div>
            )}
            {offers.length > 0 && (
              <ul aria-label={t("cart.offers")} className="flex flex-wrap gap-2">
                {offers.map((offer) => (
                  <li
                    key={offer}
                    className="flex min-h-11 items-center gap-2 rounded-pill bg-highlight-soft px-4 text-sm font-semibold"
                  >
                    <BadgePercent
                      className="size-4.5 shrink-0"
                      aria-hidden="true"
                      strokeWidth={2}
                    />
                    {offer}
                  </li>
                ))}
              </ul>
            )}
            <h2 className="sr-only">{t("order.lines")}</h2>
            <ul className="flex flex-col gap-3">
              {view.lines.map((line) => (
                <CartLine key={line.id} line={line} t={t} actions={actions} locked={locked} />
              ))}
            </ul>
            <a href="/" className="gf-link self-start text-sm">
              {t("cart.continue")}
            </a>
          </div>
          <CartSummary view={view} t={t} actions={actions} />
          <div
            data-sticky-buy=""
            className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-(--z-sticky) flex items-center gap-4 rounded-tile bg-field p-3 pl-5 shadow-float lg:hidden"
          >
            <p className="flex flex-col leading-tight">
              <span className="text-xs text-text-2">{t("cart.subtotal")}</span>
              <span className="tabular text-lg font-extrabold">{view.subtotal}</span>
            </p>
            <a href="/odeme" className="gf-btn flex-1">
              {t("cart.checkout")}
            </a>
          </div>
        </div>
      </div>
      {view.upsell && (
        <Upsell
          title={view.upsell.title}
          products={view.upsell.products}
          t={t}
          quickAdd={actions.addToCart}
        />
      )}
    </Container>
  )
}
