import { ImageOff, Minus, Plus, ShoppingBag, Trash2, Truck } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { CartLineView, CartPageView, ThemeActions, Translate } from "@qticaret/ui"
import { Alert, AlertDescription } from "@qticaret/ui/components/alert"
import { Button } from "@qticaret/ui/components/button"
import { cn } from "@qticaret/ui/lib/utils"

const MAX_QUANTITY = 99

// The production CSP refuses inline style attributes: the bar's width is a
// class, in 5% steps, each written out so Tailwind generates it
const FILLS = [
  "w-0",
  "w-[5%]",
  "w-[10%]",
  "w-[15%]",
  "w-[20%]",
  "w-[25%]",
  "w-[30%]",
  "w-[35%]",
  "w-[40%]",
  "w-[45%]",
  "w-[50%]",
  "w-[55%]",
  "w-[60%]",
  "w-[65%]",
  "w-[70%]",
  "w-[75%]",
  "w-[80%]",
  "w-[85%]",
  "w-[90%]",
  "w-[95%]",
  "w-full",
] as const
const fillOf = (percent: number): string =>
  FILLS[Math.min(20, Math.max(0, Math.floor(percent / 5)))] ?? "w-0"

/**
 * One line. Minus, plus and remove are the form's own submit buttons, each
 * sending its quantity: no script needed, no "update" button to forget.
 */
function CartLine({
  line,
  t,
  actions,
}: {
  line: CartLineView
  t: Translate
  actions: ThemeActions
}) {
  const step =
    "flex size-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
  return (
    <li className="flex gap-4 py-5">
      <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-muted">
        {line.image ? (
          <ResponsiveImage image={line.image} sizes="96px" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-5" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3">
        <div className="flex justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium">{line.title}</p>
            {line.detail && <p className="text-muted-foreground">{line.detail}</p>}
          </div>
          <p className="tabular flex flex-col items-end text-sm">
            <span className="font-semibold">{line.total}</span>
            {line.original && (
              <s className="text-xs text-muted-foreground">
                <span className="sr-only">{t("price.before")} </span>
                {line.original}
              </s>
            )}
          </p>
        </div>
        <form action={actions.changeCartLine} className="flex items-center justify-between">
          <input type="hidden" name="line_id" value={line.id} />
          <div
            role="group"
            aria-label={t("cart.quantity_of", { title: line.title })}
            className="flex items-center rounded-full border"
          >
            <button
              type="submit"
              name="quantity"
              value={line.quantity - 1}
              aria-label={t("product.decrease")}
              className={step}
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="tabular w-8 text-center text-sm font-medium" aria-live="polite">
              {line.quantity}
            </span>
            <button
              type="submit"
              name="quantity"
              value={line.quantity + 1}
              disabled={line.quantity >= MAX_QUANTITY}
              aria-label={t("product.increase")}
              className={step}
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="submit"
            name="remove"
            value="1"
            aria-label={t("cart.remove_line", { title: line.title })}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t("cart.remove")}
          </button>
        </form>
      </div>
    </li>
  )
}

/** The cart: its lines, discounts and subtotal; the checkout comes with D7. */
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
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-muted">
          <ShoppingBag className="size-7 text-muted-foreground" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{t("cart.title")}</h1>
        <p className="text-muted-foreground">{t("cart.empty")}</p>
        <Button asChild size="lg" className="rounded-full px-7">
          <a href="/">{t("cart.continue")}</a>
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("cart.title")}</h1>
      {view.error && (
        <Alert variant="destructive">
          <AlertDescription>{view.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ul className="divide-y border-y">
          {view.lines.map((line) => (
            <CartLine key={line.id} line={line} t={t} actions={actions} />
          ))}
        </ul>
        <aside
          aria-label={t("cart.summary")}
          className="flex h-fit flex-col gap-4 rounded-2xl bg-muted p-6 text-sm lg:sticky lg:top-36"
        >
          <h2 className="text-base font-semibold">{t("cart.summary")}</h2>
          {view.freeShipping && (
            <div className="flex flex-col gap-2 rounded-xl bg-background p-3">
              <p className="flex items-center gap-2 text-xs font-medium">
                <Truck className="size-4 shrink-0" aria-hidden="true" />
                {view.freeShipping.message}
              </p>
              <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full",
                    view.freeShipping.reached ? "bg-success" : "bg-primary",
                    fillOf(view.freeShipping.percent)
                  )}
                />
              </div>
            </div>
          )}
          <dl className="tabular flex flex-col gap-3">
            {view.discount && (
              <>
                <div className="flex justify-between">
                  <dt>{t("cart.items")}</dt>
                  <dd>{view.items}</dd>
                </div>
                <div className="flex justify-between text-sale">
                  <dt>{t("cart.discount")}</dt>
                  <dd>−{view.discount}</dd>
                </div>
              </>
            )}
            <div className="flex justify-between border-t border-foreground/10 pt-3 text-base">
              <dt className="font-medium">{t("cart.subtotal")}</dt>
              <dd className="font-semibold">{view.subtotal}</dd>
            </div>
          </dl>
          <Button size="lg" disabled className="h-12 rounded-full text-base">
            {t("cart.checkout")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t("cart.checkout_soon")}</p>
          <a href="/" className="text-center font-medium underline-offset-4 hover:underline">
            {t("cart.continue")}
          </a>
        </aside>
      </div>
    </div>
  )
}
