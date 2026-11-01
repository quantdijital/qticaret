import { ResponsiveImage } from "@qticaret/ui"
import type { CartPageView, Translate } from "@qticaret/ui"

/** The cart: its lines and subtotal (changing quantities and checkout come in D6–D7). */
export function CartPage({ view, t }: { view: CartPageView; t: Translate }) {
  if (view.lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{t("cart.title")}</h1>
        <p className="text-muted">{t("cart.empty")}</p>
        <a
          href="/"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink"
        >
          {t("cart.continue")}
        </a>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("cart.title")}</h1>
      <div className="grid gap-8 md:grid-cols-[1fr_18rem]">
        <ul className="divide-y divide-line border-y border-line">
          {view.lines.map((line) => (
            <li key={line.id} className="flex gap-4 py-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-subtle">
                {line.image && (
                  <ResponsiveImage
                    image={line.image}
                    sizes="80px"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 text-sm">
                <p className="font-medium">{line.title}</p>
                {line.detail && <p className="text-muted">{line.detail}</p>}
                <p className="text-muted">{t("cart.quantity", { quantity: line.quantity })}</p>
              </div>
              <p className="text-sm font-semibold">{line.total}</p>
            </li>
          ))}
        </ul>
        <aside className="flex h-fit flex-col gap-3 rounded-xl border border-line p-5">
          <p className="flex justify-between text-sm">
            <span>{t("cart.subtotal")}</span>
            <span className="font-semibold">{view.subtotal}</span>
          </p>
          <p className="text-sm text-muted">{t("cart.checkout_soon")}</p>
        </aside>
      </div>
    </div>
  )
}
