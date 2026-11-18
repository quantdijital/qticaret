"use client"

import { useEffect } from "react"

/** On an image once its picture is loaded and decoded (or has failed: its words then show). */
const LOADED = "data-js-loaded"
/** On `<html>` while this runs: the stylesheet may wait for `LOADED`. */
const READY = "data-js-img"

/**
 * Tells the stylesheet which images are ready to show (`card.css`,
 * `motion.css`): an image gets `data-js-loaded` once its picture is
 * loaded and decoded, so a card's second photo fades in over the first
 * only when there is a picture to fade (every look), and with the lively
 * motion a lazy image fades in instead of popping (adr/0067 Ek
 * 2026-11-18). One listener on the document catches every image's load,
 * those a client navigation adds included; the images already loaded are
 * marked once. `<html>` carries `data-js-img` while it runs: before the
 * script, or without it, the stylesheet waits for nothing and draws as
 * it always did. No layout is read, nothing moves.
 */
export function ImageCue() {
  useEffect(() => {
    const root = document.documentElement
    const mark = (image: HTMLImageElement) => {
      if (image.hasAttribute(LOADED)) {
        return
      }
      // Decoded first, so a fade never starts on an empty frame; a failed decode shows at once
      image
        .decode()
        .catch(() => undefined)
        .finally(() => {
          image.setAttribute(LOADED, "")
        })
    }
    const settled = (event: Event) => {
      if (event.target instanceof HTMLImageElement) {
        mark(event.target)
      }
    }
    // An image's load and error do not bubble: caught on the way down
    document.addEventListener("load", settled, true)
    document.addEventListener("error", settled, true)
    for (const image of document.images) {
      if (image.complete) {
        image.setAttribute(LOADED, "")
      }
    }
    root.setAttribute(READY, "")
    return () => {
      document.removeEventListener("load", settled, true)
      document.removeEventListener("error", settled, true)
      root.removeAttribute(READY)
    }
  }, [])
  return null
}
