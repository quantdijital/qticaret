import { Trash2 } from "lucide-react"
import { AddonEditor, GiftRecipient } from "@qticaret/theme-base"
import { ResponsiveImage } from "@qticaret/ui"
import type { CartLineView, ThemeActions, Translate } from "@qticaret/ui"
import { LineAddons } from "../parts/LineAddons"
import { LinePrice } from "../parts/LinePrice"
import { MAX_QUANTITY, Stepper } from "../parts/Stepper"

function Picture({ line }: { line: CartLineView }) {
  return (
    <div className="size-24 shrink-0 overflow-hidden rounded-media bg-paper-3 sm:size-32">
      {line.image && (
        <ResponsiveImage
          image={{ ...line.image, alt: "" }}
          sizes="(min-width: 640px) 128px, 96px"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}

function Words({ line, t }: { line: CartLineView; t: Translate }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-md leading-snug font-semibold lg:text-lg">{line.title}</p>
      {line.detail && line.detail.trim() !== line.title.trim() && (
        <p className="text-sm text-text-3">{line.detail}</p>
      )}
      <LineAddons
        addons={line.addons}
        note={line.nonWithdrawable ? t("addons.line_non_withdrawable") : null}
        className="mt-1"
      />
    </div>
  )
}

/** Under a line: its picks' limit, its picks' form, a gift card's recipient. */
function Extras({ line, t, actions }: { line: CartLineView; t: Translate; actions: ThemeActions }) {
  return (
    <>
      {typeof line.maxQuantity === "number" && (
        <p className="text-xs text-text-3">
          {t("addons.max_quantity_hint", { max: line.maxQuantity })}
        </p>
      )}
      {line.addonForm && actions.saveLineAddons && (
        <AddonEditor line={line} form={line.addonForm} save={actions.saveLineAddons} t={t} />
      )}
      {line.gift && actions.saveGiftRecipient && (
        <GiftRecipient line={line} gift={line.gift} save={actions.saveGiftRecipient} t={t} />
      )}
    </>
  )
}

/**
 * One line on the cart page, a tinted well: the photograph large, the
 * name, variant and picks, then the quantity pill, the bin and the price.
 * The pill's minus and plus and the bin are the line form's own submit
 * buttons (`changeCartLine`), so it works before the script loads. A
 * payment link's line (`locked`, adr/0051) shows its count in words.
 */
export function CartLine({
  line,
  t,
  actions,
  locked,
}: {
  line: CartLineView
  t: Translate
  actions: ThemeActions
  locked: boolean
}) {
  const price = (
    <LinePrice
      total={line.total}
      original={line.original}
      before={t("price.before")}
      large
      className="ml-auto"
    />
  )
  if (locked) {
    return (
      <li className="flex gap-4 rounded-tile bg-paper-2 p-3 sm:p-4">
        <Picture line={line} />
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
          <Words line={line} t={t} />
          <div className="flex items-end justify-between gap-3">
            <p className="tabular text-sm text-text-2">
              {t("cart.line_quantity", { count: line.quantity })}
            </p>
            {price}
          </div>
          {line.gift && actions.saveGiftRecipient && (
            <GiftRecipient line={line} gift={line.gift} save={actions.saveGiftRecipient} t={t} />
          )}
        </div>
      </li>
    )
  }
  return (
    <li className="flex gap-4 rounded-tile bg-paper-2 p-3 sm:p-4">
      <Picture line={line} />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <form
          action={actions.changeCartLine}
          className="flex flex-1 flex-col justify-between gap-3"
        >
          <input type="hidden" name="line_id" value={line.id} />
          <Words line={line} t={t} />
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
            <div className="flex items-center gap-1">
              <Stepper
                quantity={line.quantity}
                most={line.maxQuantity ?? MAX_QUANTITY}
                words={{
                  group: t("cart.quantity_of", { title: line.title }),
                  decrease: t("product.decrease"),
                  increase: t("product.increase"),
                }}
              />
              <button
                type="submit"
                name="remove"
                value="1"
                aria-label={t("cart.remove_line", { title: line.title })}
                className="gf-icon-btn gap-1.5 px-3 text-sm font-semibold text-text-2"
              >
                <Trash2 className="size-4.5" aria-hidden="true" strokeWidth={1.75} />
                <span className="max-sm:sr-only">{t("cart.remove")}</span>
              </button>
            </div>
            {price}
          </div>
        </form>
        <Extras line={line} t={t} actions={actions} />
      </div>
    </li>
  )
}
