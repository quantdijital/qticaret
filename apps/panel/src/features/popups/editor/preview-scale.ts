import { useLayoutEffect, useRef, useState } from "react"
import type { PopupDesign, PopupLayout } from "@/features/popups/api/types"

export type Device = "desktop" | "mobile"

/** The screen the pop-up is laid out on before it is scaled down: a laptop and a phone. */
export const VIEWPORTS: Record<Device, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
}

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
 * (its viewport, or more when a long pop-up grew it) times the scale.
 */
export function scaledHeight(screenHeight: number, viewportHeight: number, scale: number): number {
  return Math.ceil(Math.max(screenHeight, viewportHeight) * scale)
}

/**
 * Follows the room's width and the unscaled screen's height (it grows
 * with its pop-up), both as they are resized; a transform does not change
 * an element's own layout size, so the screen is measured as laid out.
 */
export function useScaledScreen(device: Device) {
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
  }, [device])
  const viewport = VIEWPORTS[device]
  const scale = fitScale(size.room, viewport.width)
  return {
    room,
    screen,
    scale,
    height: scaledHeight(size.screen, viewport.height, scale),
  }
}
