import type { ToPanelMessage, ToStorefrontMessage } from "@qticaret/types/editor-bridge"
import type { MissingReason } from "./bridge-client"

/** The frame must say it is ready this soon, or the live preview is given up (adr/0065 §6). */
export const READY_MS = 5000
/** A redraw asked for must be done this soon, or the live preview is given up. */
export const RENDER_MS = 15000
/** A frame that left the preview is loaded again at most this often, else given up. */
export const RELOAD_LIMIT = 3
export const RELOAD_WINDOW_MS = 10_000

export type Payload<T extends ToStorefrontMessage["type"]> = Extract<
  ToStorefrontMessage,
  { type: T }
>["payload"]

/** The frame's Faz 2 messages, handed on as read (still the frame's word: checked by the taker). */
export type PickMessage = Extract<
  ToPanelMessage,
  { type: "hover" | "click" | "field" | "navigate-request" | "location" | "left" }
>

/** What the theme editor's preview (`useLivePreview`) is given. */
export interface LivePreviewOptions {
  /** The draft has been saved once: there is something to show. */
  ready: boolean
  /** Grows with each save: the frame redraws (live) or a new link is asked for. */
  round: number
  /** The page shown with the draft; null: the home page. */
  page: string | null
  /**
   * The page asked for is still looked up (its first sample): the frame
   * stays on the page it shows until `page` names it.
   */
  holding?: boolean
  /** The section whose form is open. */
  selected: string | null
  onKey: (key: "undo" | "redo" | "escape") => void
  onMissing: (id: string, reason: MissingReason) => void
  /** Faz 2's messages from the frame (hover, click, a field's label, links held, the page shown, a page left). */
  onPick?: (message: PickMessage) => void
}
