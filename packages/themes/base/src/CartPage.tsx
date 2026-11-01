import { ResponsiveImage } from "@qticaret/ui"
import type { CartLineView, CartPageView, ThemeActions, Translate } from "@qticaret/ui"

function CartLine({
  line,
  t,
  actions,
}: {
  line: CartLineView
  t: Translate
  actions: ThemeActions
}) {
  return (
    <li className="flex gap-4 py-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        {line.image && (
          <ResponsiveImage image={line.image} sizes="80px" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 text-sm">
        <div>
          <p className="font-medium">{line.title}</p>
          {line.detail && <p className="text-muted-foreground">{line.detail}</p>}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <form action={actions.changeCartLine} className="flex items-end gap-2">
            <input type="hidden" name="line_id" value={line.id} />
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("cart.quantity")}
              <input
                type="number"
                name="quantity"
                min={1}
                max={99}
                defaultValue={line.quantity}
                inputMode="numeric"
                className="w-16 rounded-md border border-border px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
            >
              {t("cart.update")}
            </button>
          </form>
          <form action={actions.changeCartLine}>
            <input type="hidden" name="line_id" value={line.id} />
            <input type="hidden" name="remove" value="1" />
            <button
              type="submit"
              aria-label={t("cart.remove_line", { title: line.title })}
              className="rounded-md px-3 py-1.5 text-muted-foreground underline hover:text-foreground"
            >
              {t("cart.remove")}
            </button>
          </form>
        </div>
      </div>
      <p className="flex flex-col items-end text-sm">
        {line.original && (
          <s className="text-xs text-muted-foreground">
            <span className="sr-only">{t("price.before")} </span>
            {line.original}
          </s>
        )}
        <span className="font-semibold">{line.total}</span>
      </p>
    </li>
  )
}

/** The cart: lines with their quantity and removal, discounts and the subtotal (checkout: D7). */
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
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t("cart.title")}</h1>
        <p className="text-muted-foreground">{t("cart.empty")}</p>
        <a
          href="/"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          {t("cart.continue")}
        </a>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("cart.title")}</h1>
      {view.error && (
        <p role="alert" className="rounded-md border border-sale px-4 py-3 text-sm text-sale">
          {view.error}
        </p>
      )}
      <div className="grid gap-8 md:grid-cols-[1fr_18rem]">
        <ul className="divide-y divide-border border-y border-border">
          {view.lines.map((line) => (
            <CartLine key={line.id} line={line} t={t} actions={actions} />
          ))}
        </ul>
        <aside className="flex h-fit flex-col gap-3 rounded-xl border border-border p-5 text-sm">
          {view.discount && (
            <>
              <p className="flex justify-between">
                <span>{t("cart.items")}</span>
                <span>{view.items}</span>
              </p>
              <p className="flex justify-between text-sale">
                <span>{t("cart.discount")}</span>
                <span>−{view.discount}</span>
              </p>
            </>
          )}
          <p className="flex justify-between border-t border-border pt-3">
            <span>{t("cart.subtotal")}</span>
            <span className="font-semibold">{view.subtotal}</span>
          </p>
          <p className="text-muted-foreground">{t("cart.checkout_soon")}</p>
        </aside>
      </div>
    </div>
  )
}
