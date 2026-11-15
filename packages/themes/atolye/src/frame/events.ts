/**
 * The window events the frame's parts talk through.
 *
 * - `qt:open-menu`: the bottom bar asks the menu drawer to open; the
 *   drawer cancels it when it heard it, else the link goes to `/kategoriler`.
 * - `qt:open-search`: the bottom bar asks the header's dropping search (a
 *   header whose search is an icon, `SearchDrop`) to open; it cancels it
 *   when it heard it, else "Ara" puts the cursor in the header's field.
 * - `qt:cookie-preferences`: the footer's link asks the cookie banner to
 *   open again; else the link goes to `/cerez-tercihleri`.
 * - `qt:cart-added`: the purchase form put a line in the cart; the cart
 *   drawer opens to show it. A card's quick add sends the words to say
 *   with it (`detail.message`), which the cart's live region reads out.
 * - `qt:quick-view`: a card's "Hızlı bak" asks the layout's dialog to show
 *   the product (`detail`: `QuickViewAsk`); the dialog cancels it when it
 *   heard it, else the button goes to the product's page.
 * - `qt:quick-view-soon`: the pointer or the focus is on a card's button:
 *   the dialog's code may load now, before the click.
 */
export const OPEN_MENU_EVENT = "qt:open-menu"
export const OPEN_SEARCH_EVENT = "qt:open-search"
export const COOKIE_PREFERENCES_EVENT = "qt:cookie-preferences"
export const CART_ADDED_EVENT = "qt:cart-added"
export const QUICK_VIEW_EVENT = "qt:quick-view"
export const QUICK_VIEW_SOON_EVENT = "qt:quick-view-soon"

/** What a card's button asks the quick view to show: the dialog's title before the answer. */
export interface QuickViewAsk {
  productId: string
  title: string
  path: string
}

/** The product a `qt:quick-view` event asks for; null for anything else. */
export const quickViewAsked = (event: Event): QuickViewAsk | null => {
  const detail =
    event instanceof CustomEvent ? (event.detail as Partial<QuickViewAsk> | null) : null
  return typeof detail?.productId === "string" &&
    typeof detail.title === "string" &&
    typeof detail.path === "string"
    ? { productId: detail.productId, title: detail.title, path: detail.path }
    : null
}

/** Asks the layout's quick view to show a product; true when it will (it cancelled the event). */
export function askQuickView(ask: QuickViewAsk): boolean {
  return !window.dispatchEvent(new CustomEvent(QUICK_VIEW_EVENT, { detail: ask, cancelable: true }))
}

/** What a `qt:cart-added` event asks the cart to say, when it brings words. */
export const cartAddedMessage = (event: Event): string =>
  event instanceof CustomEvent &&
  typeof (event.detail as { message?: unknown } | null)?.message === "string"
    ? (event.detail as { message: string }).message
    : ""

/**
 * What the opened cart sheet says first: the words that came with the line
 * (the product page's and the quick view's "Sepete eklendi." end in a stop,
 * a card's not) and the cart's name, one stop between them.
 */
export const sheetDescription = (said: string, label: string): string =>
  said ? `${said.replace(/[.!?…]+\s*$/, "")}. ${label}` : label

/** The button a `qt:cart-added` event came from, for the drawer to give the focus back to (Z-03). */
export const cartAddedOrigin = (event: Event): HTMLElement | null => {
  const origin =
    event instanceof CustomEvent ? (event.detail as { origin?: unknown } | null)?.origin : null
  return origin instanceof HTMLElement ? origin : null
}

/**
 * The button that sent a form: the one to go back to once the drawer it
 * opens shuts. Pressed, it is disabled while the form is busy and the
 * focus drops to the page, so it is taken here, at the submit.
 */
export const submitterOf = (event: { nativeEvent: Event }): HTMLElement | null => {
  const { submitter } = event.nativeEvent as SubmitEvent
  return submitter instanceof HTMLElement ? submitter : null
}

/** Tells the cart a line went in, with the words its live region says and the button that sent it. */
export function announceCartAdded(message: string, origin: HTMLElement | null = null): void {
  window.dispatchEvent(new CustomEvent(CART_ADDED_EVENT, { detail: { message, origin } }))
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
