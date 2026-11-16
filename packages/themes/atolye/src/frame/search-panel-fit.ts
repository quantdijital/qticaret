"use client"

import { useEffect, useLayoutEffect } from "react"
import type { RefObject } from "react"

/** How wide the live panel opens on a wide screen at the least (owner 2026-11-16). */
export const PANEL_WIDE_REM = 56

/** Where the wide panel goes: the search box's place, the header's content edges, all in px. */
export interface PanelFrame {
  box: { left: number; width: number }
  edge: { left: number; right: number }
  /** The panel's least width (`PANEL_WIDE_REM` in px). */
  wanted: number
}

/**
 * The wide panel's place (from 1024 px, adr/0049 Ek 2026-11-16): it
 * starts at the box's left edge and is as wide as the box or `wanted`,
 * whichever is wider, never wider than the header's content; where it
 * would pass the content's right edge it moves left until its right edge
 * stands on it (never past the content's left edge). `x`: its left from
 * the box's left. Pure, for the test.
 */
export function panelPlace({ box, edge, wanted }: PanelFrame): { x: number; width: number } {
  const room = Math.max(0, edge.right - edge.left)
  const width = Math.min(Math.max(box.width, wanted), room)
  const left = Math.max(edge.left, Math.min(box.left, edge.right - width))
  return { x: left - box.left, width }
}

const WIDE = "(width >= 64rem)"

/** The panel's left and width from the box and the header row's content (its gutters off). */
function placeWide(panel: HTMLElement, form: HTMLElement): void {
  const row = form.closest<HTMLElement>("[data-gf-head-row]")
  if (!row || typeof window.matchMedia !== "function" || !window.matchMedia(WIDE).matches) {
    panel.style.removeProperty("--gf-suggest-x")
    panel.style.removeProperty("--gf-suggest-w")
    return
  }
  const box = form.getBoundingClientRect()
  const area = row.getBoundingClientRect()
  const style = getComputedStyle(row)
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const { x, width } = panelPlace({
    box: { left: box.left, width: box.width },
    edge: {
      left: area.left + (parseFloat(style.paddingLeft) || 0),
      right: area.right - (parseFloat(style.paddingRight) || 0),
    },
    wanted: PANEL_WIDE_REM * rem,
  })
  panel.style.setProperty("--gf-suggest-x", `${String(x)}px`)
  panel.style.setProperty("--gf-suggest-w", `${String(width)}px`)
}

/** The room under the panel's top down to the on-screen keyboard (the visual viewport's end). */
function fitAboveKeyboard(panel: HTMLElement, view: VisualViewport): void {
  const room = view.offsetTop + view.height - panel.getBoundingClientRect().top - 12
  panel.style.setProperty("--gf-suggest-room", `${String(Math.max(160, Math.floor(room)))}px`)
}

/**
 * The open panel's size: on a wide screen its place and width
 * (`panelPlace`, before it is painted, again as the box or the window
 * changes size: the magnifier's box grows open); on a phone it ends
 * above the on-screen keyboard and scrolls inside.
 */
export function usePanelFit(
  form: RefObject<HTMLFormElement | null>,
  panel: RefObject<HTMLDivElement | null>,
  shown: boolean
): void {
  useLayoutEffect(() => {
    const element = panel.current
    const box = form.current
    if (!shown || !element || !box) {
      return
    }
    const place = () => {
      placeWide(element, box)
    }
    place()
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null
    observer?.observe(box)
    window.addEventListener("resize", place)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", place)
    }
  }, [form, panel, shown])

  useEffect(() => {
    const element = panel.current
    const view = window.visualViewport
    if (!shown || !element || !view) {
      return
    }
    const fit = () => {
      fitAboveKeyboard(element, view)
    }
    fit()
    view.addEventListener("resize", fit)
    view.addEventListener("scroll", fit)
    return () => {
      view.removeEventListener("resize", fit)
      view.removeEventListener("scroll", fit)
    }
  }, [panel, shown])
}
