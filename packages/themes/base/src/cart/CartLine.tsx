import { Minus, Plus, X } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { CartLineView, ThemeActions, Translate } from "@qticaret/ui"
import { GiftRecipient } from "./GiftRecipient"

const MAX_QUANTITY = 99

const STEP =
  "flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"

/**
 * One line. Minus, plus and remove are the form's own submit buttons, each
 * sending its quantity: no script needed, no "update" button to forget.
 */
export function CartLine({
  line,
  t,
  actions,
}: {
  line: CartLineView
  t: Translate
  actions: ThemeActions
}) {
  return (
    <li className="flex gap-4 py-6 first:pt-0 sm:gap-5">
      <div className="size-24 shrink-0 overflow-hidden rounded-2xl border bg-card sm:size-28">
        {line.image ? (
          <ResponsiveImage
            image={line.image}
            sizes="112px"
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="font-heading flex h-full items-center justify-center text-4xl text-foreground/10"
          >
            {line.title.charAt(0).toLocaleUpperCase("tr")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <form
          action={actions.changeCartLine}
          className="flex flex-1 flex-col justify-between gap-3"
        >
          <input type="hidden" name="line_id" value={line.id} />
          <div className="flex justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="leading-snug font-medium">{line.title}</p>
              {line.detail && <p className="text-sm text-muted-foreground">{line.detail}</p>}
            </div>
            <button
              type="submit"
              name="remove"
              value="1"
              aria-label={t("cart.remove_line", { title: line.title })}
              className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div
              role="group"
              aria-label={t("cart.quantity_of", { title: line.title })}
              className="flex items-center rounded-button border bg-card"
            >
              <button
                type="submit"
                name="quantity"
                value={line.quantity - 1}
                aria-label={t("product.decrease")}
                className={STEP}
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <span className="tabular w-8 text-center text-sm font-semibold" aria-live="polite">
                {line.quantity}
              </span>
              <button
                type="submit"
                name="quantity"
                value={line.quantity + 1}
                disabled={line.quantity >= MAX_QUANTITY}
                aria-label={t("product.increase")}
                className={STEP}
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
            <p className="tabular flex flex-col items-end">
              {line.original && (
                <s className="text-xs text-muted-foreground">
                  <span className="sr-only">{t("price.before")} </span>
                  {line.original}
                </s>
              )}
              <span className="font-semibold">{line.total}</span>
            </p>
          </div>
        </form>
        {line.gift && actions.saveGiftRecipient && (
          <GiftRecipient line={line} gift={line.gift} save={actions.saveGiftRecipient} t={t} />
        )}
      </div>
    </li>
  )
}
