import { z } from "zod"

/**
 * The theme editor's bridge (adr/0065 §2, Faz 1): the messages the panel
 * and the storefront's preview frame trade over `postMessage`. Both sides
 * read every message through these schemas; one that does not match, of a
 * version this build does not know, or larger than 64 KB is dropped
 * without a word (and counted by the side that dropped it). The origin and
 * the sending window are checked before a message reaches here (`origin`,
 * `source`); `*` is never a target.
 *
 * Faz 1 carries the stable session's handshake, the redraw after a save,
 * selecting and scrolling to a section, changing the shown page and the
 * undo keys. Faz 2 adds hovering both ways, the edit label's click, the
 * section names, and links held in the frame (`navigate-request`, then
 * `location`). Faz 2b adds a field's edit label (`field`). Patches come
 * with Faz 3: until then unknown, so dropped.
 * A new message is a new type, never a new field on an old one: a panel
 * and a storefront a release apart drop what they do not know.
 *
 * Imported by the panel and the storefront's preview route only (the
 * `@qticaret/types/editor-bridge` subpath), never by a live page.
 */

export const EDITOR_BRIDGE_CHANNEL = "qt-editor"
export const EDITOR_BRIDGE_VERSION = 1
/** The largest message either side reads, as JSON. */
export const EDITOR_BRIDGE_MAX_BYTES = 64 * 1024

/** A section's id as the design stores it (adr/0049): safe inside a CSS attribute selector. */
export const BRIDGE_SECTION_ID = /^[a-z0-9]{6,24}$/

const sectionId = z.string().regex(BRIDGE_SECTION_ID)

/**
 * A field's key inside its section (Faz 2b, adr/0065 §9): the design's own
 * path to the text or picture drawn (`heading`, `links.0`,
 * `slides.2.heading`): lowercase words and small numbers joined by dots,
 * nothing else, so it is safe inside a CSS attribute selector. The panel
 * acts on it only when its register knows the key for that section.
 */
export const BRIDGE_FIELD_KEY = /^[a-z][a-z_]{0,31}(?:\.(?:[0-9]{1,2}|[a-z][a-z_]{0,31})){0,3}$/
const fieldKey = z.string().max(80).regex(BRIDGE_FIELD_KEY)

/** The draft's edition: the moment it was last saved (ISO 8601). */
const edition = z.string().min(1).max(40)

/**
 * A page of the shop by its path (`/urun/…`, a category's, `/magaza?sirala=…`):
 * a relative path only, never another host (`//host`) nor a backslash. The
 * storefront checks it again (`previewPage`) before showing anything.
 */
const page = z
  .string()
  .max(2048)
  .regex(/^\/(?![/\\])[^\\]*$/)

/**
 * A page the frame asks to show or says it shows (Faz 2): a relative path
 * as `page`, and nothing a decoder could turn into another host or a
 * hidden character (`%2F`, `%5C`, `%00`, a control character or a space).
 */
export const BRIDGE_PATH = /^\/(?![/\\])[^\\\s]*$/
const ESCAPED = /%(?:2f|5c|00)/i
/** A control character (C0 or DEL): never in a page's path. */
const hasControl = (path: string): boolean => {
  for (let at = 0; at < path.length; at++) {
    const code = path.charCodeAt(at)
    if (code < 0x20 || code === 0x7f) {
      return true
    }
  }
  return false
}
/** Whether the frame may name `path` as a page (`navigate-request`, `location`, `left`). */
export const isBridgePath = (path: string): boolean =>
  path.length <= 2048 && BRIDGE_PATH.test(path) && !ESCAPED.test(path) && !hasControl(path)
const framePath = z.string().refine(isBridgePath)

/**
 * The longest section name a label carries: 400 names stay well inside the
 * 64 KB message limit (a longer name is cut by the panel, ellipsised in the frame).
 */
export const BRIDGE_MAX_NAME = 80
/** A section's name as the panel shows it, written by the frame as text only. */
const sectionName = z.string().max(BRIDGE_MAX_NAME)
/** The most sections a page or a label set carries. */
export const BRIDGE_MAX_SECTIONS = 400

const seq = z
  .number()
  .int()
  .min(0)
  .max(2 ** 31)

function envelope<T extends string, P extends z.ZodType>(type: T, payload: P) {
  return z.strictObject({
    channel: z.literal(EDITOR_BRIDGE_CHANNEL),
    v: z.literal(EDITOR_BRIDGE_VERSION),
    type: z.literal(type),
    seq,
    payload,
  })
}

/** How a selected section is brought into view (owner, adr/0065 karar 5). */
export const REVEALS = ["never", "if_hidden", "always"] as const
export type Reveal = (typeof REVEALS)[number]

/** Panel → storefront. */
export const toStorefrontMessage = z.discriminatedUnion("type", [
  /** Completes the handshake: the frame's scale and the section selected now. */
  envelope(
    "init",
    z.strictObject({ scale: z.number().min(0.05).max(4), selected: sectionId.nullable() })
  ),
  /** Draw the draft as last saved (`router.refresh()`); `edition` the save's, when known. */
  envelope("refresh", z.strictObject({ edition: edition.nullable() })),
  /** Select a section (null: none), bring it into view as asked, flash it once. */
  envelope(
    "select",
    z.strictObject({ id: sectionId.nullable(), reveal: z.enum(REVEALS), flash: z.boolean() })
  ),
  /** Scroll to a section without selecting it. */
  envelope("scroll-to", z.strictObject({ id: sectionId, block: z.enum(["start", "center"]) })),
  /** Show another page with the draft (null: the home page), in place of the frame's address. */
  envelope("navigate", z.strictObject({ page: page.nullable() })),
  /** The frame's scale changed (the device or the room). */
  envelope("scale", z.strictObject({ scale: z.number().min(0.05).max(4) })),
  /** Faz 2: the section the pointer is over in the panel's tree (null: none) is framed. */
  envelope("hover", z.strictObject({ id: sectionId.nullable() })),
  /** Faz 2: the edit label's word and each section's name, written as text. */
  envelope(
    "labels",
    z.strictObject({
      edit: z.string().min(1).max(40),
      names: z
        .record(sectionId, sectionName)
        .refine((names) => Object.keys(names).length <= BRIDGE_MAX_SECTIONS),
    })
  ),
])
export type ToStorefrontMessage = z.infer<typeof toStorefrontMessage>

/** Why a section asked for is not on the page (adr/0065 §6). */
export const MISSING_REASONS = ["hidden", "scheduled", "other_page", "timeout"] as const

/** Storefront → panel. */
export const toPanelMessage = z.discriminatedUnion("type", [
  /** The frame is ready: its path and the draft's edition it shows. */
  envelope(
    "ready",
    z.strictObject({
      v: z.literal(EDITOR_BRIDGE_VERSION),
      path: framePath,
      edition: edition.nullable(),
    })
  ),
  /** A redraw finished: the edition now on show and how long it took (ms). */
  envelope(
    "rendered",
    z.strictObject({ edition: edition.nullable(), ms: z.number().min(0).max(600_000) })
  ),
  /** A section asked for did not turn up. */
  envelope("missing", z.strictObject({ id: sectionId, reason: z.enum(MISSING_REASONS) })),
  /** An editor key pressed while the frame had focus. */
  envelope("key", z.strictObject({ key: z.enum(["undo", "redo", "escape"]) })),
  /** Something the frame could not do. */
  envelope("error", z.strictObject({ code: z.string().regex(/^[a-z_]{1,40}$/) })),
  /** Faz 2: the section the pointer is over in the frame (null: none). */
  envelope("hover", z.strictObject({ id: sectionId.nullable() })),
  /** Faz 2: a section's edit label was pressed: its form opens. */
  envelope("click", z.strictObject({ id: sectionId })),
  /**
   * Faz 2b: a field's edit label was pressed (a heading, a button, a
   * picture marked `data-qf`): the section's form opens at that field.
   */
  envelope("field", z.strictObject({ id: sectionId, field: fieldKey })),
  /**
   * Faz 2: a link followed (or a search sent) in the frame, held there: the
   * panel shows that page in the frame, or says it cannot be previewed.
   */
  envelope("navigate-request", z.strictObject({ path: framePath, previewable: z.boolean() })),
  /**
   * Faz 2: the page left the preview on its own (a form's redirect, say):
   * the panel reloads the frame on the preview's address for `path`
   * (null: the page left for is none the preview shows).
   */
  envelope("left", z.strictObject({ path: framePath.nullable() })),
  /** Faz 2: the page now shown and the sections on it, in page order. */
  envelope(
    "location",
    z.strictObject({
      path: framePath,
      sections: z.array(sectionId).max(BRIDGE_MAX_SECTIONS),
    })
  ),
])
export type ToPanelMessage = z.infer<typeof toPanelMessage>

type Typed<M extends { type: string; payload: unknown }, T extends M["type"]> = Extract<
  M,
  { type: T }
>["payload"]

/** The message `type` carrying `payload`, numbered `seq`. */
export function bridgeMessage<T extends ToStorefrontMessage["type"]>(
  type: T,
  payload: Typed<ToStorefrontMessage, T>,
  sequence: number
): ToStorefrontMessage
export function bridgeMessage<T extends ToPanelMessage["type"]>(
  type: T,
  payload: Typed<ToPanelMessage, T>,
  sequence: number
): ToPanelMessage
export function bridgeMessage(type: string, payload: unknown, sequence: number) {
  return {
    channel: EDITOR_BRIDGE_CHANNEL,
    v: EDITOR_BRIDGE_VERSION,
    type,
    seq: sequence,
    payload,
  }
}

/** Whether `data` fits the size limit as JSON; anything that will not serialise does not. */
function small(data: unknown): boolean {
  if (typeof data !== "object" || data === null) {
    return false
  }
  try {
    const text = JSON.stringify(data)
    return text.length <= EDITOR_BRIDGE_MAX_BYTES
  } catch {
    return false
  }
}

/** A message the storefront received, read; null for anything else. */
export function readToStorefront(data: unknown): ToStorefrontMessage | null {
  if (!small(data)) {
    return null
  }
  const parsed = toStorefrontMessage.safeParse(data)
  return parsed.success ? parsed.data : null
}

/** A message the panel received, read; null for anything else. */
export function readToPanel(data: unknown): ToPanelMessage | null {
  if (!small(data)) {
    return null
  }
  const parsed = toPanelMessage.safeParse(data)
  return parsed.success ? parsed.data : null
}
