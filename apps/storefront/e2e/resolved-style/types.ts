/**
 * The resolved style check's data (adr/0067 §3, step 0b): what one capture
 * of one page at one width (and, optionally, in one interactive state)
 * holds, and the folder's manifest.
 */

/** One drawn element: its short text (for the report only) and its resolved style. */
export interface ElementStyle {
  /** Own text, alt or accessible name, cut short; never compared. */
  t?: string
  /** Property → resolved value; a property at its default value is left out (see DEFAULTS). */
  s: Record<string, string | number>
}

/** One page at one width (and state): element key → style, in document order. */
export interface Capture {
  page: string
  /** The page's shop path (`/`, `/urun/…`); never the preview prefix. */
  path: string
  width: number
  /** The interactive state applied after load; "load" for none. */
  state: string
  elements: Record<string, ElementStyle>
}

export interface ManifestEntry {
  file: string
  page: string
  path: string
  width: number
  state: string
  elements: number
  sha256: string
  /** Time spent on this capture, ms (load, settle, state, collect). */
  ms: number
  bytes: number
}

export interface SkippedEntry {
  page: string
  width: number
  state: string
  reason: string
}

export interface Manifest {
  tool: "resolved-style"
  version: 1
  /** The base's origin; the path prefix (a preview token) is never written. */
  origin: string
  prefixed: boolean
  widths: number[]
  captures: ManifestEntry[]
  skipped: SkippedEntry[]
}

/**
 * The value a property has when an element does not set it: left out of
 * the capture to keep it small, read back as this when comparing.
 */
export const DEFAULTS: Record<string, string> = {
  "background-color": "rgba(0, 0, 0, 0)",
  "background-image": "none",
  "border-radius": "0px",
  "box-shadow": "none",
  "letter-spacing": "normal",
  "text-transform": "none",
  "text-decoration-line": "none",
  padding: "0px",
  margin: "0px",
  gap: "normal",
  opacity: "1",
  outline: "none",
  "border-top": "none",
  "border-right": "none",
  "border-bottom": "none",
  "border-left": "none",
}

/** The capture's file name for a page, width and state. */
export function captureFile(page: string, width: number, state: string): string {
  return state === "load" ? `${page}@${width}.json` : `${page}@${width}~${state}.json`
}
