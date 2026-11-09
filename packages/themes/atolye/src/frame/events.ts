/**
 * The window events the frame's parts talk through.
 *
 * - `qt:open-menu`: the bottom bar asks the menu drawer to open; the
 *   drawer cancels it when it heard it, else the link goes to `/kategoriler`.
 * - `qt:cookie-preferences`: the footer's link asks the cookie banner to
 *   open again; else the link goes to `/cerez-tercihleri`.
 * - `qt:cart-added`: the purchase form put a line in the cart; the cart
 *   drawer opens to show it. A card's quick add sends the words to say
 *   with it (`detail.message`), which the cart's live region reads out.
 */
export const OPEN_MENU_EVENT = "qt:open-menu"
export const COOKIE_PREFERENCES_EVENT = "qt:cookie-preferences"
export const CART_ADDED_EVENT = "qt:cart-added"

/** What a `qt:cart-added` event asks the cart to say, when it brings words. */
export const cartAddedMessage = (event: Event): string =>
  event instanceof CustomEvent &&
  typeof (event.detail as { message?: unknown } | null)?.message === "string"
    ? (event.detail as { message: string }).message
    : ""

/** Tells the cart a line went in, with the words its live region says. */
export function announceCartAdded(message: string): void {
  window.dispatchEvent(new CustomEvent(CART_ADDED_EVENT, { detail: { message } }))
}

/** A click the link should follow itself: a new tab, a modifier, or one already handled. */
export const isOwnClick = (event: {
  defaultPrevented: boolean
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}) =>
  event.defaultPrevented ||
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey

/**
 * Asks a part of the frame to act where the visitor is; true when one
 * did (it cancelled the event), so the link stays where it is.
 */
export function askFrame(name: string): boolean {
  return !window.dispatchEvent(new Event(name, { cancelable: true }))
}
