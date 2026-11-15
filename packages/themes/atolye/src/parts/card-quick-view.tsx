import type { ProductCardView, Translate } from "@qticaret/ui"
import { QuickViewButton } from "./QuickViewButton"

/**
 * A card's quick view button while the shop has it on (the card carries
 * `quickView`, adr/0049 Ek 2026-11-15): its two words, nothing else per
 * card; the dialog's words and code are the layout's, once. `inline` (the
 * compact card) always the icon, at the row's end.
 */
export function CardQuickView({
  product,
  t,
  inline = false,
}: {
  product: ProductCardView
  t: Translate
  inline?: boolean
}) {
  if (!product.quickView) {
    return null
  }
  return (
    <QuickViewButton
      productId={product.id}
      title={product.title}
      path={product.path}
      trigger={inline ? "icon" : product.quickView}
      inline={inline}
      words={{
        open: t("product.quick_view"),
        label: t("product.quick_view_label", { title: product.title }),
      }}
    />
  )
}
