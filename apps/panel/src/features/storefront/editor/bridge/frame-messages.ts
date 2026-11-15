import type { Reveal, ToPanelMessage, ToStorefrontMessage } from "@qticaret/types/editor-bridge"
import type { LivePreviewOptions, Payload } from "./live-preview-options"

/** What the live preview remembers of its frame between renders (`useLivePreview`'s ref). */
export interface FrameState {
  seq: number
  connected: boolean
  /** When the frame last said it is ready, and whether it ever did. */
  readyAt: number
  everConnected: boolean
  /** The frame left the preview (a link followed): reloaded at the next save or page change. */
  stray: boolean
  shown: string | null
  scale: number
  after: { id: string; reveal: Reveal; flash: boolean; round: number } | null
  sentRound: number
  /** When the frame was loaded again after leaving the preview (the last few). */
  reloads: number[]
}

export const createFrameState = (round: number): FrameState => ({
  seq: 0,
  connected: false,
  readyAt: -Infinity,
  everConnected: false,
  stray: false,
  shown: null,
  scale: 1,
  after: null,
  sentRound: round,
  reloads: [],
})

/** A frame gate (`createKeyGate`, `createPickGate`): whether a message from the frame passes. */
type Gate = (focused: boolean, now: number) => boolean

/** What one message from the frame may touch: the hook's state, its setters and callbacks. */
export interface FrameContext extends Pick<
  LivePreviewOptions,
  "round" | "page" | "selected" | "onKey" | "onMissing"
> {
  onPick: LivePreviewOptions["onPick"] | undefined
  now: FrameState
  holding: boolean
  send: <T extends ToStorefrontMessage["type"]>(type: T, payload: Payload<T>) => boolean
  /** The frame has the focus (asked only when a press or key needs it). */
  focused: () => boolean
  /** Focus back to the panel. */
  blur: () => void
  keyGate: Gate
  pickGate: Gate
  setConnected: (connected: boolean) => void
  countHandshake: () => void
  setDrawn: (drawn: { round: number; page: string | null } | null) => void
  /** The frame said it left the preview with no bridge (its path unknown). */
  countLeft: () => void
  giveUp: () => void
}

/**
 * One message the frame sent (already accepted: its exact origin and
 * window, `acceptFromFrame`), acted on: the handshake, a redraw done, a
 * section missing, a key, an error, a page left, and Faz 2's picking
 * messages handed on (presses through the pick gate).
 */
export function routeFrameMessage(message: ToPanelMessage, ctx: FrameContext): void {
  const { now, send } = ctx
  switch (message.type) {
    case "ready": {
      now.readyAt = performance.now()
      now.everConnected = true
      now.stray = false
      now.connected = true
      ctx.setConnected(true)
      ctx.countHandshake()
      send("init", { scale: now.scale, selected: ctx.selected })
      // A frame just loaded shows the draft as last saved, on the page it opened at
      const shows = message.payload.path === "/" ? null : message.payload.path
      now.sentRound = ctx.round
      // While the page asked for is looked up, the frame stays where it is
      now.shown = ctx.holding ? shows : ctx.page
      ctx.setDrawn({ round: ctx.round, page: shows })
      if (shows !== now.shown) {
        send("navigate", { page: ctx.page })
      }
      return
    }
    case "rendered": {
      ctx.setDrawn({ round: now.sentRound, page: now.shown })
      const after = now.after
      if (after && now.sentRound >= after.round) {
        now.after = null
        send("select", { id: after.id, reveal: after.reveal, flash: after.flash })
      }
      return
    }
    case "missing":
      ctx.onMissing(message.payload.id, message.payload.reason)
      return
    case "key":
      // A key pressed in the frame: it has the focus; and a few a second at most
      if (!ctx.keyGate(ctx.focused(), Date.now())) {
        return
      }
      if (message.payload.key === "escape") {
        // Focus back to the panel
        ctx.blur()
      }
      ctx.onKey(message.payload.key)
      return
    case "error":
      ctx.giveUp()
      return
    case "left":
      // Out of the preview with no bridge: reloaded on the preview's address for that page
      now.connected = false
      now.stray = true
      ctx.setConnected(false)
      ctx.setDrawn(null)
      if (message.payload.path === null) {
        ctx.countLeft()
      }
      ctx.onPick?.(message)
      return
    case "click":
    case "field":
    case "navigate-request":
      // A press in the frame: it has the focus (pressing moves it there); a few a second at most
      if (ctx.pickGate(ctx.focused(), Date.now())) {
        ctx.onPick?.(message)
      }
      return
    case "hover":
    case "location":
      ctx.onPick?.(message)
      return
  }
}
