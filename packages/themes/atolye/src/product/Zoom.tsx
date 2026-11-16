"use client"

import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useRef, useState } from "react"
import type { RefObject } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView } from "@qticaret/ui"
import { LayerPortal } from "../frame/Layers"
import type { GalleryWords } from "./words"

/** Where the pointer is over the picture, as the enlarged picture's origin (CSSOM, never a style attribute). */
function follow(lens: HTMLElement, clientX: number, clientY: number) {
  const box = lens.getBoundingClientRect()
  const x = ((clientX - box.left) / box.width) * 100
  const y = ((clientY - box.top) / box.height) * 100
  lens.style.setProperty(
    "transform-origin",
    `${String(Math.min(100, Math.max(0, x)))}% ${String(Math.min(100, Math.max(0, y)))}%`
  )
}

/** A press moves less than this (px); farther is a drag (panning the enlarged picture). */
const PRESS = 8

/**
 * Whether a point is on the photograph's own pixels, not on the graphite
 * around it: the picture element fills the screen (`object-contain`), so
 * its box holds the bands beside a tall photograph or above a wide one.
 * The photograph is its natural size scaled to fit and centred in that box
 * (the box as drawn, enlarged too). Before its size is known: the whole box.
 */
export function onPicture(picture: HTMLImageElement, clientX: number, clientY: number): boolean {
  const box = picture.getBoundingClientRect()
  const wide = picture.naturalWidth || Number(picture.getAttribute("width")) || 0
  const tall = picture.naturalHeight || Number(picture.getAttribute("height")) || 0
  const fit = wide > 0 && tall > 0 ? Math.min(box.width / wide, box.height / tall) : 0
  const width = fit > 0 ? wide * fit : box.width
  const height = fit > 0 ? tall * fit : box.height
  const left = box.left + (box.width - width) / 2
  const top = box.top + (box.height - height) / 2
  return clientX >= left && clientX <= left + width && clientY >= top && clientY <= top + height
}

/**
 * A photograph full screen on graphite: the whole picture at the
 * screen's size, centred on the screen (the bar with the count and the
 * close button above it is matched by as much room below); a press on the
 * photograph enlarges it two and a half times where it was pressed and the
 * pointer then moves over it (a phone also pinches, its own zoom), a press
 * on the graphite around it closes, as a lightbox does, enlarged or not; a
 * drag (panning) does neither. The arrows and the arrow keys step through
 * the pictures, Escape or the 44 px button close it and the focus goes
 * back where it was.
 */
export function Zoom({
  images,
  start,
  words,
  returnTo,
  onClose,
}: {
  images: ImageView[]
  start: number
  words: GalleryWords
  /** The button that opens it: the focus goes back there when it closes. */
  returnTo: RefObject<HTMLElement | null>
  /** Closed on this picture: the gallery shows it too. */
  onClose: (last: number) => void
}) {
  const [index, setIndex] = useState(start)
  const [zoomed, setZoomed] = useState(false)
  const pressed = useRef<{ x: number; y: number } | null>(null)
  const lens = useRef<HTMLDivElement | null>(null)
  const count = images.length
  const image = images[index]
  const step = (by: number) => {
    setZoomed(false)
    setIndex((index + by + count) % count)
  }
  if (!image) {
    return null
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose(index)
        }
      }}
    >
      <LayerPortal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-stage" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            // No Trigger here (the gallery opens it): say where the focus goes
            event.preventDefault()
            returnTo.current?.focus()
          }}
          className="gf-stage fixed inset-x-0 top-0 z-(--z-modal) flex h-dvh flex-col outline-none"
          onKeyDown={(event) => {
            if (count > 1 && event.key === "ArrowLeft") {
              step(-1)
            } else if (count > 1 && event.key === "ArrowRight") {
              step(1)
            }
          }}
          onPointerDown={(event) => {
            pressed.current = { x: event.clientX, y: event.clientY }
          }}
          onPointerUp={(event) => {
            const from = pressed.current
            pressed.current = null
            // A drag pans the enlarged picture; a press on a button is the button's
            const target = event.target instanceof Element ? event.target : null
            if (
              !from ||
              Math.hypot(event.clientX - from.x, event.clientY - from.y) >= PRESS ||
              target?.closest("button, a")
            ) {
              return
            }
            const picture = lens.current?.querySelector("img")
            if (lens.current && picture && onPicture(picture, event.clientX, event.clientY)) {
              // On the photograph: enlarge where it was pressed, or let go
              follow(lens.current, event.clientX, event.clientY)
              setZoomed(!zoomed)
            } else {
              // On the graphite around it (or the bars): close, the focus back to the opener
              onClose(index)
            }
          }}
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-4 px-4">
            <Dialog.Title className="tabular max-w-none text-sm font-semibold tracking-normal text-stage-text-2">
              {words.position.replace("{n}", String(index + 1)).replace("{count}", String(count))}
            </Dialog.Title>
            <Dialog.Close className="gf-icon-btn bg-stage-2" aria-label={words.close}>
              <X className="size-5" aria-hidden="true" strokeWidth={2} />
            </Dialog.Close>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={lens}
              data-zoomed={zoomed ? "" : undefined}
              className="gf-zoom absolute inset-0"
              onPointerMove={(event) => {
                if (zoomed) {
                  follow(event.currentTarget, event.clientX, event.clientY)
                }
              }}
            >
              <ResponsiveImage
                key={image.src}
                image={image}
                sizes="100vw"
                priority
                className="absolute inset-0 h-full w-full object-contain select-none"
              />
            </div>
            {count > 1 && (
              <>
                <button
                  type="button"
                  className="gf-icon-btn absolute top-1/2 left-3 size-12 -translate-y-1/2 bg-stage-2"
                  aria-label={words.previous}
                  onClick={() => {
                    step(-1)
                  }}
                >
                  <ChevronLeft className="size-6" aria-hidden="true" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="gf-icon-btn absolute top-1/2 right-3 size-12 -translate-y-1/2 bg-stage-2"
                  aria-label={words.next}
                  onClick={() => {
                    step(1)
                  }}
                >
                  <ChevronRight className="size-6" aria-hidden="true" strokeWidth={2} />
                </button>
              </>
            )}
          </div>
          {/* As much room below as the bar above: the photograph is centred on the screen.
              4rem holds a phone's home-bar inset (34 px at most), so no more is added */}
          <div className="h-16 shrink-0" data-zoom-foot="" />
        </Dialog.Content>
      </LayerPortal>
    </Dialog.Root>
  )
}
