/**
 * What another theme may borrow from this one (adr/0046 Ek 2026-11-05)
 * without taking the whole theme: the pages it has not drawn yet, a home
 * section, and parts of flows it does not draw (a gift line's recipient
 * and a line's add-on picks in the cart, the order's return request and
 * gift). Its own entry (`@qticaret/theme-base/borrow`), apart from
 * `baseTheme`: the storefront bundles every client component a theme's
 * module reaches into each page's script (docs/21, 2026-11-06), so a
 * theme that imported `baseTheme` would ship this theme's header, menus,
 * cart drawer and cookie dialog to every visitor without drawing them.
 */
export { BrandsPage } from "./BrandsPage"
export { ConfirmPage } from "./ConfirmPage"
export { CookiePreferencesPage } from "./CookiePreferencesPage"
export { GiftCardBalancePage } from "./GiftCardBalancePage"
export { PaymentLinkPage } from "./PaymentLinkPage"
export { FeaturedProductSection } from "./home/FeaturedProductSection"
export { AddonEditor } from "./cart/AddonEditor"
export { GiftRecipient } from "./cart/GiftRecipient"
export { OrderReturns } from "./account/OrderReturns"
export { OrderGift } from "./checkout/OrderGift"
