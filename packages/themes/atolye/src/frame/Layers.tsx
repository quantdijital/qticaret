"use client"

import { Dialog } from "radix-ui"
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react"

/**
 * Where the page's layers go (adr/0067 Ek 2026-11-15). A Radix portal
 * draws its dialog at the end of `body`, outside the theme's root element,
 * so the marks the stylesheet reads there (`data-chip-style`,
 * `data-media-ground`, …) would never reach a drawer or a dialog. While a
 * style kit step is off its default, `LayerMarks` keeps one host at the
 * end of `body` carrying the root's marks, `display: contents` so it draws
 * nothing, and every layer of the theme goes into it: still a child of
 * `body` (no stacking, overflow or transform of the page above it; focus
 * trap, scroll lock and `aria-hidden` work as before), with an ancestor
 * that says what the root says. At today's drawing there is no host and
 * the layers go where they always went.
 *
 * Every portal of the theme goes through here (`LayerPortal`, or
 * `useLayerHost` as a portal's `container`); a test keeps a bare
 * `*.Portal` out of the theme's other files.
 */
const LayerHost = createContext<HTMLElement | undefined>(undefined)

export function LayerMarks({
  marks,
  children,
}: {
  /** `layerMarks(theme)`: the root's marks, `null` at today's drawing. */
  marks: Record<string, string> | null
  children: ReactNode
}) {
  // Made once in the browser, put in `body` only while it has marks to carry
  const [host] = useState(() => {
    if (typeof document === "undefined") {
      return undefined
    }
    const element = document.createElement("div")
    element.style.display = "contents"
    return element
  })
  const needed = marks !== null
  useLayoutEffect(() => {
    if (!host || !needed) {
      return
    }
    document.body.append(host)
    return () => {
      host.remove()
    }
  }, [host, needed])
  useLayoutEffect(() => {
    if (!host || !marks) {
      return
    }
    for (const name of host.getAttributeNames()) {
      if (name.startsWith("data-") && !(name in marks)) {
        host.removeAttribute(name)
      }
    }
    for (const [name, value] of Object.entries(marks)) {
      host.setAttribute(name, value)
    }
  }, [host, marks])
  return <LayerHost value={needed ? host : undefined}>{children}</LayerHost>
}

/** The element a portal of the theme draws into; `undefined`: `body`, as Radix does by itself. */
export function useLayerHost(): HTMLElement | undefined {
  return useContext(LayerHost)
}

/** `Dialog.Portal` for the theme: the dialog's overlay and content go to the layers' host. */
export function LayerPortal({ children }: { children: ReactNode }) {
  return <Dialog.Portal container={useLayerHost()}>{children}</Dialog.Portal>
}
