import { useEffect } from "react"
import type { RefObject } from "react"

/** How far a mouse moves before a press becomes a drag (a shorter move is a click). */
const THRESHOLD = 6

/**
 * Dragging the row with a mouse (the shop's `drag`): a press on the row
 * that moves past a few pixels scrolls it with the pointer, the snap off
 * while it moves (`data-dragging`, `scroller.css`) and the click that ends
 * it swallowed so no card opens. Touch and pen keep the browser's own
 * swipe; nothing happens unless the shop turned it on.
 */
export function useScrollerDrag(track: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const element = track.current
    if (!on || !element) {
      return
    }
    let pointer: number | null = null
    let startX = 0
    let startLeft = 0
    let moved = false
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) {
        return
      }
      pointer = event.pointerId
      startX = event.clientX
      startLeft = element.scrollLeft
      moved = false
    }
    const move = (event: PointerEvent) => {
      if (pointer !== event.pointerId) {
        return
      }
      const by = event.clientX - startX
      if (!moved && Math.abs(by) > THRESHOLD) {
        moved = true
        element.dataset["dragging"] = ""
        element.setPointerCapture(event.pointerId)
      }
      if (moved) {
        element.scrollLeft = startLeft - by
      }
    }
    const up = (event: PointerEvent) => {
      if (pointer !== event.pointerId) {
        return
      }
      pointer = null
      // The snap comes back on and settles the row on a card
      delete element.dataset["dragging"]
    }
    const click = (event: MouseEvent) => {
      if (moved) {
        event.preventDefault()
        event.stopPropagation()
        moved = false
      }
    }
    // A photo or a link would start the browser's own drag
    const native = (event: DragEvent) => {
      event.preventDefault()
    }
    element.addEventListener("pointerdown", down)
    element.addEventListener("pointermove", move)
    element.addEventListener("pointerup", up)
    element.addEventListener("pointercancel", up)
    element.addEventListener("click", click, true)
    element.addEventListener("dragstart", native)
    return () => {
      element.removeEventListener("pointerdown", down)
      element.removeEventListener("pointermove", move)
      element.removeEventListener("pointerup", up)
      element.removeEventListener("pointercancel", up)
      element.removeEventListener("click", click, true)
      element.removeEventListener("dragstart", native)
    }
  }, [track, on])
}
