import type { Translate } from "@qticaret/ui"
import type { CartSheetWords } from "./CartSheet"

/** The cart drawer's words; `{title}` and `{count}` are filled in the browser. */
export const cartSheetWords = (t: Translate, count: number): CartSheetWords => ({
  label: t("nav.cart_label", { count }),
  short: t("nav.bottom.cart"),
  title: t("cart.title_count", { count }),
  empty: t("cart.empty"),
  browse: t("home.shop_categories"),
  continue: t("cart.continue"),
  subtotal: t("cart.subtotal"),
  note: t("cart.drawer_note"),
  viewCart: t("cart.view"),
  checkout: t("cart.checkout"),
  close: t("nav.close"),
  line: {
    quantity: t("order.quantity"),
    remove: t("cart.remove_line", { title: "{title}" }),
    group: t("cart.quantity_of", { title: "{title}" }),
    decrease: t("product.decrease"),
    increase: t("product.increase"),
    before: t("price.before"),
    nonWithdrawable: t("addons.line_non_withdrawable"),
  },
})
