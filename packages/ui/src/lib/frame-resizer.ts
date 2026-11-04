/**
 * The host side of iframe-resizer's message protocol, as a card provider's
 * hosted form speaks it (PayTR's iFrame API: its pages run the library's
 * content script and expect the shop to run `iFrameResize({}, '#paytriframe')`,
 * docs/entegrasyonlar/paytr.md). Written here rather than loading the
 * provider's host script: the storefront's CSP keeps `script-src` to its
 * own nonce'd code, and the provider's file listens to every window
 * message without checking where it came from. Only the height is taken,
 * only from the frame's own window and origin.
 *
 * Wire format (iframe-resizer 2–3, which PayTR's host file is):
 * - host → frame, once a page is loaded: `[iFrameSizer]<id>:<bodyMarginV1>:
 *   <sizeWidth>:<log>:<interval>:<enablePublicMethods>:<autoResize>:
 *   <bodyMargin>:<heightCalculationMethod>:<bodyBackground>:<bodyPadding>:
 *   <tolerance>:<inPageLinks>:<resizeFrom>:<widthCalculationMethod>`;
 *   the frame says nothing until it has it.
 * - host → frame, when the frame's width changes: `[iFrameSizer]resize`.
 * - frame → host: `[iFrameSizer]<id>:<height>:<width>:<type>[:<message>]`.
 */

export const RESIZER_PREFIX = "[iFrameSizer]"
/** The frame's name in the protocol, as PayTR's own snippet names its iframe. */
export const RESIZER_FRAME_ID = "paytriframe"

/** What PayTR's `iFrameResize({}, '#paytriframe')` sends a page: the library's defaults. */
export const RESIZER_INIT = `${RESIZER_PREFIX}${RESIZER_FRAME_ID}:8:false:false:32:true:true:null:bodyOffset:null:null:0:false:parent:scroll`
/** Asks the page for its size again (the host's window or the frame's width changed). */
export const RESIZER_RESIZE = `${RESIZER_PREFIX}resize`

/** The frame's height until its page says one, and for a page that says none (a bank's 3-D Secure page). */
export const FRAME_DEFAULT_HEIGHT = 640
/** Never shorter: a page that reports a collapsed body still shows its form. */
export const FRAME_MIN_HEIGHT = 360
/** Never taller: a page cannot push the shop's page down without end. */
export const FRAME_MAX_HEIGHT = 4000

// The frame's messages that are not a size (closing, scrolling the host, page info, links)
const NOT_A_SIZE = new Set([
  "close",
  "message",
  "scrollTo",
  "scrollToOffset",
  "pageInfo",
  "pageInfoStop",
  "inPageLink",
  "reset",
])

/**
 * The frame's height from one window message, clamped; null for anything
 * else: another origin, another frame, not the protocol, not a size.
 */
export function frameHeightOf(data: unknown, origin: string, frameOrigin: string): number | null {
  if (origin !== frameOrigin || typeof data !== "string" || !data.startsWith(RESIZER_PREFIX)) {
    return null
  }
  const [id, height, , type] = data.slice(RESIZER_PREFIX.length).split(":")
  if (id !== RESIZER_FRAME_ID || type === undefined || NOT_A_SIZE.has(type)) {
    return null
  }
  const value = Number(height)
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }
  return Math.min(FRAME_MAX_HEIGHT, Math.max(FRAME_MIN_HEIGHT, Math.ceil(value)))
}

/** The origin a frame's address loads from, or null for one that cannot be read. */
export function frameOriginOf(src: string, base: string): string | null {
  try {
    const origin = new URL(src, base).origin
    return origin === "null" ? null : origin
  } catch {
    return null
  }
}
