"use client"

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import type { TurnstileGate } from "@qticaret/types"
import type { GateHandle } from "../lib/gate"
import { TurnstileWidget, loadTurnstile } from "../lib/turnstile"

/**
 * A form's Turnstile widget (adr/0044 Ek 2026-11-24). Nothing is drawn or
 * loaded until the form wants a token: an every-send gate (`eager`: the
 * sign-ins, the payment) warms up when the shopper first touches the form,
 * a past-the-limit gate only once the backend's 428 asks. The slot holds
 * no room while Cloudflare decides alone and opens, with a line saying
 * why, only when it wants the shopper to do something; it is drawn only
 * then, so a page's server HTML (and the view locks) stay as they were.
 */

export interface TurnstileSetup {
  /** The widget's public key; null: no widget, the forms send without one. */
  siteKey: string | null
  /** The slot's name for a screen reader ("Güvenlik doğrulaması"). */
  label: string
  /** Said above the box when Cloudflare wants an interaction. */
  hint: string
  language?: string
  theme?: "auto" | "light" | "dark"
}

const TurnstileContext = createContext<TurnstileSetup | null>(null)

/** The shop's key and words for every form below it (the storefront's root layout). */
export function TurnstileProvider({
  setup,
  children,
}: {
  setup: TurnstileSetup
  children: ReactNode
}) {
  return createElement(TurnstileContext.Provider, { value: setup }, children)
}

export interface TurnstileForm {
  /** For `sendGated`; null without a site key. */
  gate: GateHandle | null
  /** Starts the widget ahead of the send (an every-send gate's first touch). */
  warm: () => void
  /** The widget's place in the form, drawn only once it is wanted. */
  slot: ReactNode
}

export interface TurnstileUse {
  /** Every send carries a token: the widget warms up on the form's first touch. */
  eager?: boolean
  /** Added to the open slot (a grid form's `sm:col-span-2`). */
  className?: string
}

export function useTurnstile(
  action: TurnstileGate,
  { eager = false, className = "" }: TurnstileUse = {}
): TurnstileForm {
  const setup = useContext(TurnstileContext)
  const siteKey = setup?.siteKey ?? null
  const [active, setActive] = useState(false)
  const [interactive, setInteractive] = useState(false)
  const widget = useRef<TurnstileWidget | null>(null)
  const starting = useRef<Promise<TurnstileWidget> | null>(null)
  // Asked once past the limit: every later send carries a token from the start
  const armed = useRef(eager)
  const container = useRef<{ element: HTMLElement | null; waiting: ((el: HTMLElement) => void)[] }>(
    { element: null, waiting: [] }
  )

  // The slot's element, once drawn; the widget waiting for it starts then
  const [placed, place] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    container.current.element = placed
    if (placed) {
      const waiting = container.current.waiting
      container.current.waiting = []
      for (const resolve of waiting) {
        resolve(placed)
      }
    }
  }, [placed])

  useEffect(
    () => () => {
      widget.current?.destroy()
      widget.current = null
      starting.current = null
    },
    []
  )

  const start = useCallback(
    (key: string): Promise<TurnstileWidget> => {
      if (starting.current) {
        return starting.current
      }
      // Outside any transition the send runs in: its updates would wait for the send itself
      setTimeout(() => {
        setActive(true)
      }, 0)
      const element = new Promise<HTMLElement>((resolve) => {
        const known = container.current.element
        if (known) {
          resolve(known)
        } else {
          container.current.waiting.push(resolve)
        }
      })
      const started = Promise.all([loadTurnstile(), element]).then(([api, at]) => {
        widget.current ??= new TurnstileWidget(api, at, {
          siteKey: key,
          action,
          ...(setup?.language ? { language: setup.language } : {}),
          ...(setup?.theme ? { theme: setup.theme } : {}),
          onInteractive: setInteractive,
        })
        return widget.current
      })
      // A script that did not load may load at the next send
      started.catch(() => {
        starting.current = null
      })
      starting.current = started
      return started
    },
    [action, setup]
  )

  // Stable while the key is: a form's action wrapped around it stays the same function
  const gate = useMemo<GateHandle | null>(
    () =>
      siteKey
        ? {
            eager: () => armed.current,
            take: async () => {
              armed.current = true
              return (await start(siteKey)).take()
            },
            spent: () => {
              widget.current?.spent()
            },
          }
        : null,
    [siteKey, start]
  )

  const warm = useCallback(() => {
    if (siteKey && eager) {
      start(siteKey)
        .then((started) => {
          started.prepare()
        })
        .catch(() => undefined)
    }
  }, [siteKey, eager, start])

  const slot =
    active && setup
      ? createElement(
          "div",
          {
            "data-turnstile": "",
            className: interactive
              ? `flex flex-col gap-2 ${className}`.trim()
              : "absolute size-0 overflow-hidden",
          },
          createElement(
            "p",
            { role: "status", className: interactive ? "text-sm" : "sr-only" },
            interactive ? setup.hint : null
          ),
          createElement("div", { ref: place, role: "group", "aria-label": setup.label })
        )
      : null

  return { gate, warm, slot }
}
