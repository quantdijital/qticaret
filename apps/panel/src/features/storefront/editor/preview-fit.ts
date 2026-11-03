import { useLayoutEffect, useState } from "react"
import type { RefObject } from "react"

export type Device = "mobile" | "tablet" | "desktop"

export const DEVICES: readonly Device[] = ["mobile", "tablet", "desktop"]

/**
 * The width the storefront is drawn at for each preset: a phone, a tablet
 * and a laptop. A wider room than the laptop's draws the desktop as wide
 * as the room itself.
 */
export const DEVICE_WIDTHS: Record<Device, number> = { mobile: 390, tablet: 768, desktop: 1280 }

export interface Fit {
  /** The storefront's own width and height, before scaling. */
  width: number
  height: number
  /** How much it is scaled down to fit the room (1: not at all). */
  scale: number
}

/**
 * The storefront drawn at the device's width, scaled down as a whole when
 * the room is narrower: never cut off at the side, never shown wider than
 * it is. It fills the room's height at that scale.
 */
export function fitPreview(device: Device, room: { width: number; height: number }): Fit {
  const own =
    device === "desktop" ? Math.max(DEVICE_WIDTHS.desktop, room.width) : DEVICE_WIDTHS[device]
  if (room.width <= 0 || room.height <= 0) {
    return { width: own, height: Math.max(room.height, 0), scale: 1 }
  }
  // Rounded down to a thousandth: the scaled frame never overshoots the room by a pixel
  const scale = Math.min(1, Math.floor((room.width / own) * 1000) / 1000)
  return { width: own, height: Math.floor(room.height / scale), scale }
}

/** The room an element offers, followed as it is resized; kept while it is hidden. */
export function useRoom(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [room, setRoom] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    const measure = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      // A hidden room (the phone's other view) keeps the last size it had
      if (width > 0 && height > 0) {
        setRoom((was) => (was.width === width && was.height === height ? was : { width, height }))
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [ref])
  return room
}
