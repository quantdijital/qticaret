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
 * undo keys. Hover, click, sections and patches come with later phases:
 * until then their types are unknown here, so dropped.
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
      path: z.string().max(2048),
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
