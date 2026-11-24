import type { StorePopup } from "./store"
import type { PopupPage } from "./rules"

/**
 * The storefront's choice of a pop-up (adr/0080 §3–§4), written here as
 * the reference the theme follows (S3): the backend sends every live
 * pop-up, the storefront picks at most one per page view with what only
 * the browser knows (the page, the screen, the visitor's history).
 */

/** The page being viewed; the pages after the cart are never a pop-up's. */
export type StorefrontPageKind =
  | PopupPage
  | "cart"
  | "checkout"
  | "payment"
  | "account"
  /** Every other page (search, brand, collection, a listing): `all` only. */
  | "other"

/** Pages no pop-up ever stands on, whatever it says. */
export const POPUP_BLOCKED_PAGES: readonly StorefrontPageKind[] = Object.freeze([
  "cart",
  "checkout",
  "payment",
  "account",
])

/** What the browser remembers of one pop-up (functional storage, no personal data). */
export interface PopupMemory {
  /** When it was last shown (ms since epoch). */
  shown_at?: number
  /** Closed, clicked or signed up from: done with. */
  dismissed?: boolean
}

export interface PopupViewContext {
  page: StorefrontPageKind
  device: "desktop" | "mobile"
  /** Seen the shop before this visit. */
  returning: boolean
  /** Signed in as a customer. */
  member: boolean
  now: Date
  /** Pop-ups shown already in this browser session. */
  session: ReadonlySet<string>
  memory: Readonly<Record<string, PopupMemory>>
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whether the pop-up is for this page, screen and visitor. */
export function popupMatches(popup: StorePopup, context: PopupViewContext): boolean {
  if (POPUP_BLOCKED_PAGES.includes(context.page)) {
    return false
  }
  const { targeting } = popup
  if (targeting.pages !== "all" && !targeting.pages.includes(context.page as PopupPage)) {
    return false
  }
  if (targeting.device !== "all" && targeting.device !== context.device) {
    return false
  }
  if (targeting.visitor === "new" && context.returning) {
    return false
  }
  if (targeting.visitor === "returning" && !context.returning) {
    return false
  }
  if (targeting.membership === "member" && !context.member) {
    return false
  }
  if (targeting.membership === "guest" && context.member) {
    return false
  }
  return popup.ends_at === null || new Date(popup.ends_at).getTime() > context.now.getTime()
}

/** Whether its frequency lets it show again now. */
export function popupDue(popup: StorePopup, context: PopupViewContext): boolean {
  if (context.session.has(popup.id)) {
    // At most once a session, whatever the frequency
    return false
  }
  const memory = context.memory[popup.id]
  switch (popup.frequency.kind) {
    case "session":
      return true
    case "until_closed":
      return memory?.dismissed !== true
    case "days":
      return (
        memory?.shown_at === undefined ||
        context.now.getTime() - memory.shown_at >= (popup.frequency.days ?? 1) * DAY_MS
      )
  }
}

/**
 * The one pop-up for this page view: the first, by priority, that matches
 * and is due; null: none. The list comes ordered from the backend.
 */
export function pickPopup(
  popups: readonly StorePopup[],
  context: PopupViewContext
): StorePopup | null {
  return popups.find((popup) => popupMatches(popup, context) && popupDue(popup, context)) ?? null
}
