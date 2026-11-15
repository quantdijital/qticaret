import type { Translate } from "@qticaret/ui"
import { buyWords } from "../product/words"

/**
 * The quick view dialog's words (adr/0049 Ek 2026-11-15), translated once
 * for the layout's dialog, never per card: the buy column's own (price,
 * options, quantity, the button and its refusals) and the dialog's.
 * `discount` and `picture` keep their placeholders, filled in the dialog.
 */
export const quickViewWords = (t: Translate) => ({
  ...buyWords(t, []),
  discountTemplate: t("product.discount", { percent: "{percent}" }),
  close: t("product.quick_view_close"),
  loading: t("product.quick_view_loading"),
  failed: t("product.quick_view_failed"),
  missing: t("product.quick_view_missing"),
  openPage: t("product.quick_view_open"),
  pictures: t("product.quick_view_pictures"),
  picture: t("product.quick_view_picture", { number: "{number}" }),
})

export type QuickViewWords = ReturnType<typeof quickViewWords>

/** "%30 indirim" for each discount the product's variants carry. */
export const discountWords = (
  template: string,
  percents: readonly (number | null)[]
): Record<number, string> =>
  Object.fromEntries(
    percents.flatMap((percent) =>
      percent === null ? [] : [[percent, template.replace("{percent}", String(percent))]]
    )
  )
