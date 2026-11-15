"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useTransition } from "react"
import { EDITOR_BRIDGE_VERSION, bridgeMessage } from "@qticaret/types/editor-bridge"
import type { Reveal, ToPanelMessage, ToStorefrontMessage } from "@qticaret/types/editor-bridge"
import {
  acceptMessage,
  editorKey,
  needsScroll,
  previewHref,
  sectionSelector,
  selectionCss,
} from "./bridge-core"

/** How long a section asked for may take to turn up (a new one after its redraw). */
const WAIT_MS = 5000
/** A redraw that never ends is given up on, so the next one can run. */
const REDRAW_LIMIT_MS = 15000
const FLASH_MS = 1200

interface Props {
  /** The panel's exact origin (`PANEL_ORIGIN`, as `frame-ancestors` names it). */
  panelOrigin: string
  /** The draft's edition this render shows (the moment it was saved). */
  edition: string | null
  /** This response's CSP nonce, for the bridge's one style element. */
  nonce: string | undefined
}

type Payload<T extends ToPanelMessage["type"]> = Extract<ToPanelMessage, { type: T }>["payload"]

/**
 * The theme editor's bridge in the preview frame (adr/0065 §2–§3, Faz 1):
 * loaded only on `/onizleme/<sfs_…>` and only while framed. It says it is
 * ready, then redraws the draft in place after each save
 * (`router.refresh()`: the scroll and the page's own state stay), shows
 * another page without reloading the frame, scrolls to and flashes the
 * section asked for, and passes the editor's keys to the panel. It reads
 * the panel's exact origin only and writes to it only; it writes nothing
 * but its own style element, never HTML.
 */
export function EditorBridge({ panelOrigin, edition, nonce }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const live = useRef({
    seq: 0,
    edition,
    drawing: false,
    again: false,
    startedAt: 0,
    scale: 1,
    selected: null as string | null,
    flashes: 0,
    flash: null as { id: string; n: number; reduced: boolean } | null,
    style: null as HTMLStyleElement | null,
    waiting: null as (() => void) | null,
    pathname,
  })
  useEffect(() => {
    live.current.edition = edition
    live.current.pathname = pathname
  }, [edition, pathname])

  // A redraw ended (its transition settled): what is on show now, and the next waiting one
  const draw = useRef<(job: () => void) => void>(() => undefined)
  useEffect(() => {
    const state = live.current
    if (pending || !state.drawing) {
      return
    }
    state.drawing = false
    send("rendered", {
      edition: state.edition,
      ms: Math.round(performance.now() - state.startedAt),
    })
    if (state.again) {
      state.again = false
      draw.current(() => {
        router.refresh()
      })
    }
  })

  function send<T extends ToPanelMessage["type"]>(type: T, payload: Payload<T>) {
    const message = bridgeMessage(type as never, payload as never, live.current.seq++)
    window.parent.postMessage(message, panelOrigin)
  }

  useEffect(() => {
    if (window.parent === window || !panelOrigin) {
      return
    }
    const state = live.current
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const paint = () => {
      if (!state.style) {
        state.style = document.createElement("style")
        if (nonce) {
          state.style.nonce = nonce
        }
        state.style.dataset["qtEditor"] = ""
        document.head.appendChild(state.style)
      }
      state.style.textContent = selectionCss(state.selected, state.scale, state.flash)
    }
    let flashTimer: ReturnType<typeof setTimeout> | undefined
    const flash = (id: string) => {
      state.flashes += 1
      state.flash = { id, n: state.flashes, reduced: reduced() }
      clearTimeout(flashTimer)
      flashTimer = setTimeout(() => {
        state.flash = null
        paint()
      }, FLASH_MS)
    }
    /** Calls `found` with the section's element once it is in the page, or says it is missing. */
    const whenFound = (id: string, found: (element: Element) => void) => {
      state.waiting?.()
      const selector = sectionSelector(id)
      const now = selector ? document.querySelector(selector) : null
      if (now || !selector) {
        if (now) {
          found(now)
        }
        return
      }
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector)
        if (element) {
          stop()
          found(element)
        }
      })
      const timer = setTimeout(() => {
        stop()
        send("missing", { id, reason: "timeout" })
      }, WAIT_MS)
      const stop = () => {
        observer.disconnect()
        clearTimeout(timer)
        if (state.waiting === stop) {
          state.waiting = null
        }
      }
      state.waiting = stop
      observer.observe(document.body, { childList: true, subtree: true })
    }
    const reveal = (element: Element, how: Reveal, block: "start" | "center" = "start") => {
      if (needsScroll(element.getBoundingClientRect(), window.innerHeight, how)) {
        element.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block })
      }
    }
    draw.current = (job) => {
      if (state.drawing) {
        state.again = true
        return
      }
      state.drawing = true
      state.startedAt = performance.now()
      startTransition(job)
      const started = state.startedAt
      setTimeout(() => {
        if (state.drawing && state.startedAt === started) {
          state.drawing = false
          send("error", { code: "redraw_timeout" })
        }
      }, REDRAW_LIMIT_MS)
    }

    const handle = (message: ToStorefrontMessage) => {
      switch (message.type) {
        case "init":
          state.scale = message.payload.scale
          state.selected = message.payload.selected
          paint()
          return
        case "scale":
          state.scale = message.payload.scale
          paint()
          return
        case "refresh":
          draw.current(() => {
            router.refresh()
          })
          return
        case "navigate": {
          const href = previewHref(state.pathname, message.payload.page)
          state.waiting?.()
          draw.current(() => {
            router.replace(href, { scroll: true })
          })
          return
        }
        case "select": {
          const { id, reveal: how, flash: flashing } = message.payload
          state.selected = id
          paint()
          if (id) {
            whenFound(id, (element) => {
              reveal(element, how)
              if (flashing) {
                flash(id)
              }
              paint()
            })
          } else {
            state.waiting?.()
          }
          return
        }
        case "scroll-to":
          whenFound(message.payload.id, (element) => {
            reveal(element, "always", message.payload.block)
          })
          return
      }
    }
    const onMessage = (event: MessageEvent) => {
      const message = acceptMessage(event, panelOrigin, window.parent)
      if (message) {
        handle(message)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      const key = editorKey(event)
      if (!key) {
        return
      }
      if (key !== "escape") {
        event.preventDefault()
      }
      send("key", { key })
    }
    window.addEventListener("message", onMessage)
    window.addEventListener("keydown", onKey, true)
    const page = new URL(window.location.href).searchParams.get("sayfa")
    send("ready", { v: EDITOR_BRIDGE_VERSION, path: page ?? "/", edition: state.edition })
    return () => {
      window.removeEventListener("message", onMessage)
      window.removeEventListener("keydown", onKey, true)
      clearTimeout(flashTimer)
      state.waiting?.()
      state.style?.remove()
      state.style = null
    }
    // Set up once per frame: the panel's origin and the nonce do not change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOrigin, nonce])

  return null
}
