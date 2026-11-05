"use client"

import { ChevronLeft, ChevronRight, ImageOff, Maximize2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView } from "@qticaret/ui"
import { useHydrated } from "@qticaret/ui/hooks/use-hydrated"
import { Thumbs } from "./Thumbs"
import type { GalleryWords } from "./words"
import { Zoom } from "./Zoom"

const slideId = (n: number) => `gorsel-${String(n)}`

const smooth = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"

/**
 * The product's photographs (sahip 2026-11-05: smaller, every photograph
 * in sight): one square in a soft tinted well (the shop's dark-ground
 * photographs read on the light page without a graphite stage), its
 * thumbnails in a row right under it. The square is still a rail that
 * snaps: a phone swipes it, a keyboard scrolls it, from 1024 px two round
 * arrows step through, a thumbnail swaps it (anchors before the script).
 * A press on the picture or the round zoom button opens it full screen.
 * Only the first loads eagerly (LCP). Without a photograph the well holds
 * the name's first letter.
 */
export function Gallery({
  images,
  initial,
  words,
}: {
  images: ImageView[]
  /** The product's first letter, while it has no photograph. */
  initial: string
  words: GalleryWords
}) {
  const rail = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState<number | null>(null)
  const hydrated = useHydrated()
  const count = images.length

  // The picture in view follows the rail (a swipe, a key, an anchor)
  useEffect(() => {
    const list = rail.current
    if (!list || count < 2) {
      return
    }
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Mostly in view: a picture still partly in view while the next comes is not it
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setIndex(Number((entry.target as HTMLElement).dataset["index"] ?? 0))
          }
        }
      },
      { root: list, threshold: 0.6 }
    )
    for (const slide of list.children) {
      seen.observe(slide)
    }
    return () => {
      seen.disconnect()
    }
  }, [count])

  // A step slides; a jump (a thumbnail, the last to the first) swaps at once
  const go = (to: number) => {
    const list = rail.current
    const next = (to + count) % count
    const step = Math.abs(next - index) === 1
    list?.scrollTo({ left: next * list.clientWidth, behavior: step ? smooth() : "auto" })
    setIndex(next)
  }

  if (count === 0) {
    return (
      <div className="gf-pictures flex aspect-square flex-col items-center justify-center gap-3 rounded-tile bg-paper-2 text-sm text-text-2">
        <span aria-hidden="true" className="text-[10rem] leading-none font-extrabold text-paper-3">
          {initial}
        </span>
        <span className="flex items-center gap-2">
          <ImageOff className="size-4" aria-hidden="true" strokeWidth={2} />
          {words.noImage}
        </span>
      </div>
    )
  }

  const position = words.position
    .replace("{n}", String(index + 1))
    .replace("{count}", String(count))
  return (
    <section aria-label={words.label} className="gf-pictures flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-tile bg-paper-2">
        <ul
          ref={rail}
          className="gf-gallery flex overflow-x-auto"
          tabIndex={count > 1 ? 0 : undefined}
          aria-label={count > 1 ? words.label : undefined}
        >
          {images.map((image, n) => (
            <li
              key={image.src}
              id={slideId(n + 1)}
              data-index={n}
              className="relative aspect-square w-full shrink-0"
              onClick={() => {
                setZoom(n)
              }}
            >
              <ResponsiveImage
                image={image}
                sizes="(min-width: 1280px) 680px, (min-width: 768px) 46vw, 100vw"
                priority={n === 0}
                className="absolute inset-0 h-full w-full cursor-zoom-in object-contain"
              />
            </li>
          ))}
        </ul>
        {count > 1 && (
          <p
            aria-live="polite"
            className="tabular pointer-events-none absolute bottom-3 left-3 rounded-pill bg-stage/80 px-3 py-1 text-xs font-semibold text-stage-text"
          >
            {position}
          </p>
        )}
        {hydrated && (
          <button
            type="button"
            className="gf-icon-btn absolute top-3 right-3 bg-stage/80 text-stage-text hover:bg-stage-2 focus-visible:outline-signal-on-stage"
            aria-label={words.zoom}
            onClick={() => {
              setZoom(index)
            }}
          >
            <Maximize2 className="size-5" aria-hidden="true" strokeWidth={2} />
          </button>
        )}
        {hydrated && count > 1 && (
          <>
            <button
              type="button"
              className="gf-icon-btn absolute top-1/2 left-3 -translate-y-1/2 bg-stage/80 text-stage-text hover:bg-stage-2 focus-visible:outline-signal-on-stage max-lg:hidden"
              aria-label={words.previous}
              onClick={() => {
                go(index - 1)
              }}
            >
              <ChevronLeft className="size-6" aria-hidden="true" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="gf-icon-btn absolute top-1/2 right-3 -translate-y-1/2 bg-stage/80 text-stage-text hover:bg-stage-2 focus-visible:outline-signal-on-stage max-lg:hidden"
              aria-label={words.next}
              onClick={() => {
                go(index + 1)
              }}
            >
              <ChevronRight className="size-6" aria-hidden="true" strokeWidth={2} />
            </button>
          </>
        )}
      </div>
      {count > 1 && (
        <Thumbs images={images} index={index} slideId={slideId} onChoose={go} words={words} />
      )}
      {zoom !== null && (
        <Zoom
          images={images}
          start={zoom}
          words={words}
          onClose={(last) => {
            setZoom(null)
            go(last)
          }}
        />
      )}
    </section>
  )
}
