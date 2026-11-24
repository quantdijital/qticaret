import type { PopupPageKind, PopupTargetPage, PopupView } from "../popup-views"

/**
 * The storefront's choice of a pop-up (adr/0080 §3–§4), shared by every
 * theme: the backend sends every live pop-up, the browser picks at most
 * one per page view with what only it knows (the page, the screen, the
 * visitor's history). Pure; it mirrors the backend's reference
 * `apps/backend/src/lib/popups/targeting.ts` (the backend's build does not
 * compile workspace TypeScript, adr/0046 §8), and the tests of both hold
 * the same cases.
 */

/** Pages no pop-up ever stands on, whatever it says. */
export const POPUP_BLOCKED_PAGES: readonly PopupPageKind[] = Object.freeze([
  "cart",
  "checkout",
  "payment",
  "account",
])

/**
 * The storefront's own addresses of the blocked pages: known from the
 * address alone, so no page has to say it (and a page that forgot to
 * could never let one in). A prefix stands for itself and what is under it.
 */
const BLOCKED_PATHS: readonly [string, PopupPageKind][] = [
  ["/sepet", "cart"],
  ["/odeme", "checkout"],
  // A payment link (adr/0051)
  ["/ode", "payment"],
  ["/hesap", "account"],
  // An order's page and its documents
  ["/siparis", "account"],
]

/** The blocked page an address is, or null for any other. */
export function blockedPageOf(pathname: string): PopupPageKind | null {
  for (const [prefix, kind] of BLOCKED_PATHS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return kind
    }
  }
  return null
}

/** What the browser remembers of one pop-up (functional storage, no personal data). */
export interface PopupMemory {
  /** When it was last shown (ms since epoch). */
  shown_at?: number
  /** Closed, clicked or signed up from: done with. */
  dismissed?: boolean
}

export interface PopupViewContext {
  page: PopupPageKind
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

/** Whether the pop-up is for this page, screen and visitor, and not past its end. */
export function popupMatches(popup: PopupView, context: PopupViewContext): boolean {
  if (POPUP_BLOCKED_PAGES.includes(context.page)) {
    return false
  }
  const { targeting } = popup
  if (targeting.pages !== "all" && !targeting.pages.includes(context.page as PopupTargetPage)) {
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
  if (popup.endsAt === null) {
    return true
  }
  const end = new Date(popup.endsAt).getTime()
  // An end the browser cannot read is no reason to show it
  return Number.isFinite(end) && end > context.now.getTime()
}

/** Whether its frequency lets it show again now. */
export function popupDue(popup: PopupView, context: PopupViewContext): boolean {
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
  popups: readonly PopupView[],
  context: PopupViewContext
): PopupView | null {
  return popups.find((popup) => popupMatches(popup, context) && popupDue(popup, context)) ?? null
}

/**
 * Whether the visitor has scrolled `percent` % of the page: the bottom of
 * the screen against the page's height. A page shorter than the screen is
 * seen whole at once.
 */
export function scrolledPast(
  percent: number,
  page: { scrollY: number; viewport: number; height: number }
): boolean {
  const scrollable = page.height - page.viewport
  if (scrollable <= 0) {
    return true
  }
  return (page.scrollY / scrollable) * 100 >= percent
}
