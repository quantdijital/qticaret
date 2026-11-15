import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { bridgeMessage } from "@qticaret/types/editor-bridge"
import type { Reveal, ToStorefrontMessage } from "@qticaret/types/editor-bridge"
import { LAYOUT_KEY, fetchLayoutPreview } from "@/features/storefront/api/layout"
import { previewAddress } from "@/features/storefront/layout/preview-url"
import { BRIDGE_ON, acceptFromFrame, createKeyGate, frameOrigin } from "./bridge-client"
import { READY_MS, RELOAD_LIMIT, RELOAD_WINDOW_MS, RENDER_MS } from "./live-preview-options"
import type { LivePreviewOptions as Options, Payload } from "./live-preview-options"
import { useEditorSession } from "./use-editor-session"

export { READY_MS, RENDER_MS } from "./live-preview-options"
export type { PickMessage } from "./live-preview-options"

/**
 * The theme editor's preview (adr/0065 Faz 1–2): a live session at one
 * address while the bridge works (a save redraws the frame in place, the
 * page changes inside it, a section is scrolled to and flashed; Faz 2's
 * picking messages handed on, a page that left the preview loaded again),
 * else today's signed link per save (adr/0049), the frame reloading each
 * time: when the build turns the bridge off, the session is refused, or
 * the frame does not answer.
 */
export function useLivePreview({
  ready,
  round,
  page,
  holding = false,
  selected,
  onKey,
  onMissing,
  onPick,
}: Options) {
  const [failed, setFailed] = useState(false)
  const session = useEditorSession(BRIDGE_ON && ready && !failed)
  const live = BRIDGE_ON && !failed && !session.isError
  const legacy = useQuery({
    queryKey: [...LAYOUT_KEY, "preview", round],
    queryFn: fetchLayoutPreview,
    enabled: ready && !live,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  })
  // The live frame's one address: the session's, on the page shown when it opened (or was
  // loaded again, `frameKey`, after it left the preview)
  const [frameKey, setFrameKey] = useState(0)
  const [left, setLeft] = useState(0)
  const [base, setBase] = useState<{ address: string; key: number } | null>(null)
  const sessionAddress = session.data ? previewAddress(session.data, undefined, page) : null
  if (live && sessionAddress && base?.key !== frameKey) {
    setBase({ address: sessionAddress, key: frameKey })
  }
  const address = live
    ? (base?.address ?? null)
    : legacy.data
      ? previewAddress(legacy.data, undefined, page)
      : null
  const origin = frameOrigin(address)

  const frame = useRef<HTMLIFrameElement | null>(null)
  // A callback ref: the frame's element kept for posting to its window
  const attach = useCallback((element: HTMLIFrameElement | null) => {
    frame.current = element
  }, [])
  const state = useRef({
    seq: 0,
    connected: false,
    /** When the frame last said it is ready, and whether it ever did. */
    readyAt: -Infinity,
    everConnected: false,
    /** The frame left the preview (a link followed): reloaded at the next save or page change. */
    stray: false,
    shown: null as string | null,
    scale: 1,
    after: null as { id: string; reveal: Reveal; flash: boolean; round: number } | null,
    sentRound: round,
    /** When the frame was loaded again after leaving the preview (the last few). */
    reloads: [] as number[],
  })
  const keyGate = useRef(createKeyGate())
  const [connected, setConnected] = useState(false)
  // Each `ready` the frame says: what it was told before (the names) is told again
  const [handshakes, setHandshakes] = useState(0)
  // What the live frame shows now: the save drawn and the page; anything else is on its way
  const [drawn, setDrawn] = useState<{ round: number; page: string | null } | null>(null)
  const busy = connected && drawn !== null && (drawn.round !== round || drawn.page !== page)

  const send = useCallback(
    <T extends ToStorefrontMessage["type"]>(type: T, payload: Payload<T>) => {
      const target = frame.current?.contentWindow
      if (!target || !origin || !state.current.connected) {
        return false
      }
      target.postMessage(
        bridgeMessage(type as never, payload as never, state.current.seq++),
        origin
      )
      return true
    },
    [origin]
  )

  const giveUp = useEffectEvent(() => {
    state.current.connected = false
    setConnected(false)
    setDrawn(null)
    setBase(null)
    setFailed(true)
  })

  // The frame's messages: its exact origin and window only
  const onFrame = useEffectEvent((event: MessageEvent) => {
    const message = acceptFromFrame(event, origin, frame.current?.contentWindow)
    if (!message) {
      return
    }
    const now = state.current
    switch (message.type) {
      case "ready": {
        now.readyAt = performance.now()
        now.everConnected = true
        now.stray = false
        now.connected = true
        setConnected(true)
        setHandshakes((was) => was + 1)
        send("init", { scale: now.scale, selected })
        // A frame just loaded shows the draft as last saved, on the page it opened at
        const shows = message.payload.path === "/" ? null : message.payload.path
        now.sentRound = round
        // While the page asked for is looked up, the frame stays where it is
        now.shown = holding ? shows : page
        setDrawn({ round, page: shows })
        if (shows !== now.shown) {
          send("navigate", { page })
        }
        return
      }
      case "rendered": {
        setDrawn({ round: now.sentRound, page: now.shown })
        const after = now.after
        if (after && now.sentRound >= after.round) {
          now.after = null
          send("select", { id: after.id, reveal: after.reveal, flash: after.flash })
        }
        return
      }
      case "missing":
        onMissing(message.payload.id, message.payload.reason)
        return
      case "key":
        // A key pressed in the frame: it has the focus; and a few a second at most
        if (!keyGate.current(document.activeElement === frame.current, Date.now())) {
          return
        }
        if (message.payload.key === "escape") {
          // Focus back to the panel
          frame.current?.blur()
        }
        onKey(message.payload.key)
        return
      case "error":
        giveUp()
        return
      case "left":
        // Out of the preview with no bridge: reloaded on the preview's address for that page
        now.connected = false
        now.stray = true
        setConnected(false)
        setDrawn(null)
        if (message.payload.path === null) {
          setLeft((was) => was + 1)
        }
        onPick?.(message)
        return
      case "hover":
      case "click":
      case "field":
      case "navigate-request":
      case "location":
        onPick?.(message)
        return
    }
  })
  useEffect(() => {
    if (!live) {
      return
    }
    const listener = (event: MessageEvent) => {
      onFrame(event)
    }
    window.addEventListener("message", listener)
    return () => {
      window.removeEventListener("message", listener)
    }
  }, [live])

  // Each frame load must be answered by the bridge's "ready" in time
  const [loads, setLoads] = useState(0)
  useEffect(() => {
    if (!live || loads === 0) {
      return
    }
    // The bridge may say so just before the frame's load event
    const loadedAt = performance.now()
    const timer = setTimeout(() => {
      const now = state.current
      if (now.readyAt >= loadedAt - 2000) {
        return
      }
      if (!now.everConnected) {
        giveUp()
        return
      }
      // A link followed out of the preview: no bridge there until the frame is reloaded
      now.connected = false
      now.stray = true
      setConnected(false)
      setDrawn(null)
    }, READY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [live, loads])

  // Out of the preview: the next save or page change (or the frame saying it left) loads the
  // session's address again, on the page shown now
  useEffect(() => {
    if (!state.current.stray) {
      return
    }
    state.current.stray = false
    state.current.sentRound = round
    // A page that keeps leaving is not chased: past the limit, back to signed links
    const now = Date.now()
    const recent = state.current.reloads.filter((at) => now - at < RELOAD_WINDOW_MS)
    if (recent.length >= RELOAD_LIMIT) {
      giveUp()
      return
    }
    state.current.reloads = [...recent, now]
    setFrameKey((was) => was + 1)
  }, [round, page, left])

  // A save: the frame redraws in place
  useEffect(() => {
    if (!connected || round === state.current.sentRound) {
      return
    }
    state.current.sentRound = round
    send("refresh", { edition: null })
  }, [round, connected, send])

  // Another page or sample: shown inside the same frame
  useEffect(() => {
    if (!connected || holding || page === state.current.shown) {
      return
    }
    state.current.shown = page
    send("navigate", { page })
  }, [page, holding, connected, send])

  // A redraw that never ends: back to signed links
  useEffect(() => {
    if (!busy) {
      return
    }
    const timer = setTimeout(giveUp, RENDER_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [busy])

  const onFrameLoad = useCallback(() => {
    setLoads((was) => was + 1)
  }, [])
  const setScale = useCallback(
    (scale: number) => {
      if (scale !== state.current.scale) {
        state.current.scale = scale
        send("scale", { scale })
      }
    },
    [send]
  )

  const select = useCallback(
    (id: string | null, reveal: Reveal, flash: boolean) => {
      state.current.after = null
      return send("select", { id, reveal, flash })
    },
    [send]
  )
  const selectAfterSave = useCallback((id: string, reveal: Reveal) => {
    state.current.after = { id, reveal, flash: true, round: state.current.sentRound + 1 }
  }, [])

  return {
    live,
    address,
    /** A link (or session) has come: without an address the shop has no host set. */
    linked: live ? session.data !== undefined : legacy.data !== undefined,
    isError: live ? false : legacy.isError,
    error: legacy.error,
    retry: () => void legacy.refetch(),
    /** The legacy link is an earlier save's while the next one comes. */
    stale: !live && legacy.isPlaceholderData,
    /** A redraw or page change in the live frame is under way. */
    busy,
    connected,
    /** How many times the frame has said it is ready (a new bridge knows nothing yet). */
    handshakes,
    /** The frame's key: a new one reloads the session's address. */
    frameKey,
    frame: attach,
    onFrameLoad,
    setScale,
    /** Select a section in the frame now (null: none). */
    select,
    /** Select a section once the next save is drawn (a moved one). */
    selectAfterSave,
    /** Posts to the connected frame (Faz 2: hover, labels); false when none listens. */
    post: send,
  }
}

export type LivePreview = ReturnType<typeof useLivePreview>
