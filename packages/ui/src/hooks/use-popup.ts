import { useCallback, useEffect, useRef, useState } from "react"
import type { PopupMode, PopupSetup, PopupView } from "../popup-views"
import { POPUP_PAGE_EVENT, loadPopups, popupPageOf, sendPopupEvent } from "../lib/popup-client"
import {
  popupMemory,
  rememberDismissed,
  rememberShown,
  returningVisitor,
  sessionShown,
} from "../lib/popup-memory"
import type { PopupViewContext } from "../lib/popup-rules"
import { pickPopup, popupMatches, scrolledPast } from "../lib/popup-rules"
import { emitShopEvent } from "../lib/shop-events"

/** A phone's screen (Tailwind's `md` below): the device a pop-up's targeting calls mobile. */
export const POPUP_PHONE_QUERY = "(max-width: 767.98px)"

/** Without `requestIdleCallback` (Safari): this long after the page's `load`. */
const IDLE_FALLBACK_MS = 1500
/** The longest an idle callback waits on a page that is never idle. */
const IDLE_TIMEOUT_MS = 4000

type Stop = () => void

/** Runs `work` once the page has loaded and the browser is idle: never on the first paint's path. */
function afterLoadIdle(work: () => void): Stop {
  let idle: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = () => {
    if (typeof window.requestIdleCallback === "function") {
      idle = window.requestIdleCallback(work, { timeout: IDLE_TIMEOUT_MS })
    } else {
      timer = setTimeout(work, IDLE_FALLBACK_MS)
    }
  }
  if (document.readyState === "complete") {
    schedule()
  } else {
    window.addEventListener("load", schedule, { once: true })
  }
  return () => {
    window.removeEventListener("load", schedule)
    if (idle !== undefined) {
      window.cancelIdleCallback(idle)
    }
    clearTimeout(timer)
  }
}

/** Runs `go` once the pop-up's trigger fires: its seconds pass, or its share of the page is scrolled. */
function whenTriggered(trigger: PopupView["trigger"], go: () => void): Stop {
  if (trigger.kind === "delay") {
    const timer = setTimeout(go, Math.max(0, trigger.value) * 1000)
    return () => {
      clearTimeout(timer)
    }
  }
  let done = false
  const stop = () => {
    window.removeEventListener("scroll", check)
  }
  function check() {
    const reached = scrolledPast(trigger.value, {
      scrollY: window.scrollY,
      viewport: window.innerHeight,
      height: document.documentElement.scrollHeight,
    })
    if (reached && !done) {
      done = true
      stop()
      go()
    }
  }
  window.addEventListener("scroll", check, { passive: true })
  // The visitor may already be past it (a reload halfway down), or the page too short to scroll
  const first = setTimeout(check, 0)
  return () => {
    clearTimeout(first)
    stop()
  }
}

const isPhone = () => window.matchMedia(POPUP_PHONE_QUERY).matches

/** This page view as the rules read it. */
function viewContext(member: boolean): PopupViewContext {
  return {
    page: popupPageOf(window.location.pathname),
    device: isPhone() ? "mobile" : "desktop",
    returning: returningVisitor(),
    member,
    now: new Date(),
    session: sessionShown(),
    memory: popupMemory(),
  }
}

export interface ShownPopup {
  popup: PopupView
  mode: PopupMode
}

/**
 * The layout's pop-up (adr/0080 §4, §6), shared by every theme, which only
 * draws it: once the page has loaded and the browser is idle the list is
 * asked; once nothing else asks the visitor (`whenClear`: the theme's
 * cookie question answered) the first pop-up that matches this page,
 * screen and visitor and is due is chosen, and shown when its trigger
 * fires. One per page view; a page the storefront marks anew (a soft
 * navigation) is a new view. Every showing, click, close and sign-up is
 * counted (the backend's counters, GA4 through the storefront's analytics
 * within the visitor's consent) and remembered for its frequency.
 */
export function usePopup({
  setup,
  member,
  whenClear,
}: {
  setup: PopupSetup
  member: boolean
  /** Calls `go` once nothing else is asking the visitor; returns how to stop waiting. */
  whenClear: (go: () => void) => Stop
}) {
  const [shown, setShown] = useState<ShownPopup | null>(null)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(0)
  const memberNow = useRef(member)
  const waitClear = useRef(whenClear)
  const counted = useRef<{ click: boolean; close: boolean }>({ click: false, close: false })
  const showing = useRef(false)
  useEffect(() => {
    memberNow.current = member
    waitClear.current = whenClear
  })

  // A page the storefront marks at another address is another page view
  useEffect(() => {
    let path = window.location.pathname
    const next = () => {
      if (window.location.pathname !== path && !showing.current) {
        path = window.location.pathname
        setView((count) => count + 1)
      }
    }
    window.addEventListener(POPUP_PAGE_EVENT, next)
    return () => {
      window.removeEventListener(POPUP_PAGE_EVENT, next)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const stops: Stop[] = []
    const show = (popup: PopupView) => {
      if (cancelled || showing.current) {
        return
      }
      // Past its end while it waited, or the visitor went where none may stand
      if (!popupMatches(popup, viewContext(memberNow.current))) {
        return
      }
      showing.current = true
      counted.current = { click: false, close: false }
      rememberShown(popup.id)
      setShown({ popup, mode: isPhone() ? "sheet" : popup.layout })
      setOpen(true)
      sendPopupEvent(setup.events, popup.id, "impression")
      emitShopEvent({ type: "popup", action: "view", popupId: popup.id, popupType: popup.type })
    }
    stops.push(
      afterLoadIdle(() => {
        void loadPopups(setup.address).then((popups) => {
          if (cancelled || popups.length === 0) {
            return
          }
          stops.push(
            waitClear.current(() => {
              const popup = pickPopup(popups, viewContext(memberNow.current))
              if (popup && !cancelled) {
                stops.push(
                  whenTriggered(popup.trigger, () => {
                    show(popup)
                  })
                )
              }
            })
          )
        })
      })
    )
    return () => {
      cancelled = true
      for (const stop of stops) {
        stop()
      }
    }
  }, [setup.address, setup.events, view])

  const popup = shown?.popup ?? null

  /** The visitor closed it (its button, Escape, the scrim): counted once, and done with. */
  const close = useCallback(() => {
    setOpen(false)
    showing.current = false
    if (!popup || counted.current.close) {
      return
    }
    counted.current.close = true
    rememberDismissed(popup.id)
    sendPopupEvent(setup.events, popup.id, "close")
    emitShopEvent({ type: "popup", action: "close", popupId: popup.id, popupType: popup.type })
  }, [popup, setup.events])

  /** Its button followed or its code copied (once a showing), or a sign-up sent: done with. */
  const act = useCallback(
    (action: "click" | "signup") => {
      if (!popup) {
        return
      }
      if (action === "click") {
        if (counted.current.click) {
          return
        }
        counted.current.click = true
      }
      rememberDismissed(popup.id)
      sendPopupEvent(setup.events, popup.id, action)
      emitShopEvent({ type: "popup", action, popupId: popup.id, popupType: popup.type })
    },
    [popup, setup.events]
  )

  return { shown, open, close, act }
}
