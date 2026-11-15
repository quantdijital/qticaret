"use client"

import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useRef, useState } from "react"
import type { PointerEvent } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView } from "@qticaret/ui"
import { LayerPortal } from "../frame/Layers"
import type { GalleryWords } from "./words"

/** Where the pointer is over the picture, as the enlarged picture's origin (CSSOM, never a style attribute). */
function follow(event: PointerEvent<HTMLDivElement>) {
  const box = event.currentTarget.getBoundingClientRect()
  const x = ((event.clientX - box.left) / box.width) * 100
  const y = ((event.clientY - box.top) / box.height) * 100
  event.currentTarget.style.setProperty(
    "transform-origin",
    `${String(Math.min(100, Math.max(0, x)))}% ${String(Math.min(100, Math.max(0, y)))}%`
  )
}

/**
 * A photograph full screen on graphite: the whole picture at the
 * screen's size, a press enlarges it two and a half times where it was
 * pressed and the pointer then moves over it (a phone also pinches, its
 * own zoom); the arrows and the arrow keys step through the pictures,
 * Escape or the 44 px button close it and the focus goes back where it was.
 */
export function Zoom({
  images,
  start,
  words,
  onClose,
}: {
  images: ImageView[]
  start: number
  words: GalleryWords
  /** Closed on this picture: the gallery shows it too. */
  onClose: (last: number) => void
}) {
  const [index, setIndex] = useState(start)
  const [zoomed, setZoomed] = useState(false)
  const pressed = useRef<{ x: number; y: number } | null>(null)
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
          className="gf-stage fixed inset-0 z-(--z-modal) flex flex-col outline-none"
          onKeyDown={(event) => {
            if (count > 1 && event.key === "ArrowLeft") {
              step(-1)
            } else if (count > 1 && event.key === "ArrowRight") {
              step(1)
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
              data-zoomed={zoomed ? "" : undefined}
              className="gf-zoom absolute inset-0"
              onPointerDown={(event) => {
                pressed.current = { x: event.clientX, y: event.clientY }
              }}
              onPointerUp={(event) => {
                const from = pressed.current
                pressed.current = null
                // A press, not a drag: enlarge where it was pressed, or let go
                if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) < 8) {
                  follow(event)
                  setZoomed(!zoomed)
                }
              }}
              onPointerMove={(event) => {
                if (zoomed) {
                  follow(event)
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
          <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
        </Dialog.Content>
      </LayerPortal>
    </Dialog.Root>
  )
}
