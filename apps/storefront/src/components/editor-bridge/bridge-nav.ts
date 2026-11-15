import { isBridgePath } from "@qticaret/types/editor-bridge"
import { isSystemPath, normalizedPath } from "@/lib/seo/paths"

/**
 * Where the preview frame goes (adr/0065 §6, Faz 2), as plain functions:
 * a link followed or a search sent in the frame stays in the preview. The
 * frame never leaves on its own; it asks the panel (`navigate-request`),
 * which shows that page with the draft through `navigate`. The storefront
 * checks the page again on the server (`previewPage`) before drawing it.
 */

/** The storefront's own pages a live session draws with the draft (adr/0065 Ek 2026-11-15). */
export const PREVIEW_SYSTEM_PAGES: readonly string[] = ["/sepet", "/arama"]

const PREVIEW_ROOT = /^\/onizleme\/[^/?#]+/i

/** The preview's own address (`/onizleme/<token>`) from the frame's path; null outside it. */
export function previewBase(pathname: string): string | null {
  return PREVIEW_ROOT.exec(pathname)?.[0] ?? null
}

/**
 * Whether the preview draws `pathname` (normalised) with the draft: a
 * record's page or a list, the cart or the site search; never checkout,
 * an account, a token link, a route handler or a preview.
 */
export function isPreviewable(pathname: string): boolean {
  const clean = normalizedPath(pathname) ?? pathname
  return !isSystemPath(clean) || PREVIEW_SYSTEM_PAGES.includes(clean)
}

/** The page a frame's own address shows: its `sayfa`, else the home page. */
export function shownPage(search: string): string {
  const page = new URLSearchParams(search).get("sayfa")
  return page && isBridgePath(page) ? page : "/"
}

export type Held =
  /** Ours: held in the frame, asked of the panel. */
  | { kind: "ask"; path: string; previewable: boolean }
  /** Not a page the preview shows (another host, an odd scheme): held, nothing asked. */
  | { kind: "drop" }
  /** The browser's own: a new tab, a jump on this page, a mail or phone link. */
  | { kind: "pass" }

interface Here {
  /** The frame's own address (`window.location.href`). */
  href: string
}

/**
 * What to do with an address the frame is about to open: a page of the
 * shop (path and query, no fragment) is asked of the panel; a jump within
 * the page shown and a mail or phone link go on; another host, a
 * `javascript:` address, a preview's own address or anything the bridge
 * may not name is held and dropped.
 */
export function holdAddress(raw: string, here: Here): Held {
  let url: URL
  let current: URL
  try {
    current = new URL(here.href)
    url = new URL(raw, current)
  } catch {
    return { kind: "drop" }
  }
  if (url.protocol === "mailto:" || url.protocol === "tel:") {
    return { kind: "pass" }
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== current.origin) {
    return { kind: "drop" }
  }
  // A jump on the page shown (`#yorumlar`): the browser's
  if (url.hash && url.pathname === current.pathname && url.search === current.search) {
    return { kind: "pass" }
  }
  const path = `${url.pathname}${url.search}`
  if (previewBase(url.pathname) || !isBridgePath(path)) {
    return { kind: "drop" }
  }
  return { kind: "ask", path, previewable: isPreviewable(url.pathname) }
}

interface ClickLike {
  button: number
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  defaultPrevented: boolean
}

/** A plain left click: one with a modifier opens a new tab or window, the browser's own. */
export const isPlainClick = (event: ClickLike): boolean =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.shiftKey &&
  !event.altKey

/** The address a link opens in the frame itself; null for one opening elsewhere or downloading. */
export function linkAddress(anchor: Element): string | null {
  const target = anchor.getAttribute("target")
  if (anchor.hasAttribute("download") || (target && target !== "_self")) {
    return null
  }
  return anchor.getAttribute("href")
}

/**
 * The form a click sends, with the control that sends it: a submit button
 * (a `<button>` without a type is one) or a submit/image input in a form.
 * The panel's frame has no `allow-forms`, so the browser never sends a form
 * there nor fires `submit`: the bridge reads the click (and Enter, below).
 */
export function submitOf(
  target: Element
): { form: HTMLFormElement; submitter: HTMLElement } | null {
  const control = target.closest("button, input")
  if (control instanceof HTMLButtonElement && control.type === "submit" && control.form) {
    return { form: control.form, submitter: control }
  }
  if (
    control instanceof HTMLInputElement &&
    (control.type === "submit" || control.type === "image") &&
    control.form
  ) {
    return { form: control.form, submitter: control }
  }
  return null
}

const TYPED = new Set(["text", "search", "email", "url", "tel", "number", "password"])

interface EnterLike {
  key: string
  target: EventTarget | null
  defaultPrevented: boolean
  isComposing: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/**
 * The form Enter sends from a typed field (the browser's implicit
 * submission), unless the page took the key itself (a highlighted
 * suggestion opening) or an input method is composing.
 */
export function enterSubmits(event: EnterLike): HTMLFormElement | null {
  const { target } = event
  if (
    event.key !== "Enter" ||
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey ||
    !(target instanceof HTMLInputElement) ||
    !TYPED.has(target.type)
  ) {
    return null
  }
  return target.form
}

/**
 * The address a search form (a GET form to the shop) would open, its
 * fields as the query; null for a form React or a Server Action handles
 * (a function action, a POST) or one opening elsewhere.
 */
export function formAddress(form: HTMLFormElement, submitter: HTMLElement | null): string | null {
  const method = (submitter?.getAttribute("formmethod") ?? form.getAttribute("method") ?? "get")
    .trim()
    .toLowerCase()
  const target = submitter?.getAttribute("formtarget") ?? form.getAttribute("target")
  if (method !== "get" || (target && target !== "_self")) {
    return null
  }
  const action = submitter?.getAttribute("formaction") ?? form.getAttribute("action") ?? ""
  if (!action || /^\s*javascript:/i.test(action)) {
    return null
  }
  const query = new URLSearchParams()
  for (const [name, value] of new FormData(form, submitter)) {
    if (typeof value === "string") {
      query.append(name, value)
    }
  }
  const [bare = ""] = action.split(/[?#]/)
  const search = query.toString()
  return search ? `${bare}?${search}` : bare
}
