import { useLayoutEffect, useRef, useState } from "react"
import type { PopupDesign, PopupLayout } from "@/features/popups/api/types"

export type Device = "desktop" | "mobile"

/** The phone's whole screen: its sheet spans it. */
const PHONE = { width: 390, height: 844 }

/** The page shown around a laptop's pop-up on each side: the window's, the corner card's. */
export const MARGINS: Record<PopupLayout, number> = { modal: 48, corner: 32 }

/**
 * The least height of a laptop's crop: the window a little page above
 * and below, the corner card a hint of page above it.
 */
const MIN_HEIGHTS: Record<PopupLayout, number> = { modal: 360, corner: 440 }

/**
 * The pop-up's width on a laptop's storefront (Atölye's `PopupDialog`):
 * the dialog's 480 px, 720 px when the split design puts its picture
 * beside the words, the corner card's 384 px.
 */
export function boxWidth(layout: PopupLayout, design: PopupDesign, picture: boolean): number {
  if (layout === "corner") {
    return 384
  }
  return design === "split" && picture ? 720 : 480
}

/**
 * The screen the pop-up is laid out on before it is scaled down: a phone's
 * whole screen, or on a laptop the part of the page around the pop-up (its
 * storefront width and a margin each side), so the words stay readable in
 * a narrow column. Its height is a minimum: a long pop-up grows it.
 */
export function previewScreen(
  device: Device,
  layout: PopupLayout,
  design: PopupDesign,
  picture: boolean
): { width: number; height: number } {
  if (device === "mobile") {
    return PHONE
  }
  return {
    width: boxWidth(layout, design, picture) + 2 * MARGINS[layout],
    height: MIN_HEIGHTS[layout],
  }
}

/**
 * How much a screen `width` wide is scaled down to fit `room` (1: not at
 * all, never larger). Rounded down to a thousandth so the scaled screen
 * never overshoots the room by a pixel; 0 while the room is unmeasured.
 */
export function fitScale(room: number, width: number): number {
  if (!(room > 0) || !(width > 0)) {
    return 0
  }
  return Math.min(1, Math.floor((room / width) * 1000) / 1000)
}

/**
 * The height the scaled screen takes in the page: the screen's own height
 * (its minimum, or more when a long pop-up grew it) times the scale.
 */
export function scaledHeight(screenHeight: number, minHeight: number, scale: number): number {
  return Math.ceil(Math.max(screenHeight, minHeight) * scale)
}

/**
 * Follows the room's width and the unscaled screen's height (it grows
 * with its pop-up), both as they are resized; a transform does not change
 * an element's own layout size, so the screen is measured as laid out.
 */
export function useScaledScreen(screenSize: { width: number; height: number }) {
  const room = useRef<HTMLDivElement>(null)
  const screen = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ room: 0, screen: 0 })
  useLayoutEffect(() => {
    const roomElement = room.current
    const screenElement = screen.current
    if (!roomElement || !screenElement) {
      return
    }
    const measure = () => {
      const next = { room: roomElement.clientWidth, screen: screenElement.offsetHeight }
      setSize((was) => (was.room === next.room && was.screen === next.screen ? was : next))
    }
    measure()
    if (typeof ResizeObserver === "undefined") {
      return
    }
    const observer = new ResizeObserver(measure)
    observer.observe(roomElement)
    observer.observe(screenElement)
    return () => {
      observer.disconnect()
    }
  }, [screenSize.width, screenSize.height])
  const scale = fitScale(size.room, screenSize.width)
  return {
    room,
    screen,
    scale,
    height: scaledHeight(size.screen, screenSize.height, scale),
  }
}
