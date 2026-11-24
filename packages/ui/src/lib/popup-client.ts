import type { PopupEventType, PopupPageKind, PopupView } from "../popup-views"
import { blockedPageOf } from "./popup-rules"

/**
 * The pop-ups in the browser (adr/0080 §5–§6), shared by every theme: the
 * storefront's list, asked once a page is up and kept a minute; the
 * counters, sent without waiting for an answer; the page's kind, said by
 * the storefront's page. No React here; the addresses are the
 * storefront's own (the layout's `popups`), never the backend's (adr/0046 §5).
 */

/** How long a list is kept: a second page soon after asks nothing (the backend keeps it a minute too). */
export const POPUPS_KEPT_MS = 60_000

let kept: { address: string; until: number; list: Promise<PopupView[]> } | null = null

const isPopup = (value: unknown): value is PopupView => {
  const popup = value as Partial<PopupView> | null
  return (
    typeof popup === "object" &&
    popup !== null &&
    typeof popup.id === "string" &&
    typeof popup.title === "string" &&
    (popup.type === "info" || popup.type === "campaign" || popup.type === "newsletter") &&
    typeof popup.targeting === "object" &&
    typeof popup.trigger === "object" &&
    typeof popup.frequency === "object"
  )
}

async function ask(address: string): Promise<PopupView[]> {
  try {
    const response = await fetch(address, {
      headers: { accept: "application/json" },
      credentials: "same-origin",
    })
    if (!response.ok) {
      return []
    }
    const body = (await response.json()) as { popups?: unknown } | null
    return Array.isArray(body?.popups) ? body.popups.filter(isPopup) : []
  } catch {
    return []
  }
}

/** The live pop-ups, highest priority first: kept, or asked; never throws (none on a failure). */
export function loadPopups(address: string): Promise<PopupView[]> {
  const now = Date.now()
  if (kept?.address === address && kept.until > now) {
    return kept.list
  }
  const list = ask(address)
  kept = { address, until: now + POPUPS_KEPT_MS, list }
  return list
}

/** Forgets the kept list (a test's fresh page). */
export function forgetPopups(): void {
  kept = null
}

/** The address one pop-up's counters go to: `{events}/{id}/events`. */
export const popupEventUrl = (events: string, id: string): string =>
  `${events}/${encodeURIComponent(id)}/events`

/**
 * Counts what the visitor did, without waiting: a beacon, which outlives
 * the page a click leaves, else a `keepalive` request. Never throws; a
 * count lost is no visitor's problem.
 */
export function sendPopupEvent(events: string, id: string, type: PopupEventType): void {
  const url = popupEventUrl(events, id)
  const body = JSON.stringify({ type })
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))
    ) {
      return
    }
  } catch {
    // On to fetch
  }
  try {
    void fetch(url, {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Nothing more to try
  }
}

/** The window event a page sends when it says its kind (a new page view, a soft navigation too). */
export const POPUP_PAGE_EVENT = "qt:popup-page"

let marked: { kind: PopupPageKind; path: string } | null = null

/** The storefront's page says what it is (the home page, a category, a product, a content page). */
export function markPopupPage(kind: PopupPageKind): void {
  marked = { kind, path: window.location.pathname }
  window.dispatchEvent(new Event(POPUP_PAGE_EVENT))
}

/**
 * The page being viewed: a blocked page by its address first (no page
 * has to remember to say so), then what the page said, if it said it for
 * this address; else "other".
 */
export function popupPageOf(pathname: string): PopupPageKind {
  return blockedPageOf(pathname) ?? (marked?.path === pathname ? marked.kind : "other")
}

/** Forgets the page's word (a test's fresh page). */
export function forgetPopupPage(): void {
  marked = null
}

/**
 * Puts text on the clipboard: the Clipboard API, else the old copy
 * command on a hidden field (an older browser, an insecure origin); false
 * when neither took it, so the theme can say "select and copy".
 */
export async function copyText(text: string): Promise<boolean> {
  // Missing on an insecure origin, whatever the DOM's types say
  const clipboard = (navigator as Partial<Navigator>).clipboard
  try {
    if (typeof clipboard?.writeText === "function") {
      await clipboard.writeText(text)
      return true
    }
  } catch {
    // On to the old way
  }
  const field = document.createElement("textarea")
  try {
    field.value = text
    field.setAttribute("readonly", "")
    field.style.position = "fixed"
    field.style.opacity = "0"
    document.body.append(field)
    field.select()
    // The only way left where the Clipboard API is missing
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    field.remove()
  }
}
