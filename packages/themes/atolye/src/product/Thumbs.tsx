"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView } from "@qticaret/ui"
import { useHydrated } from "@qticaret/ui/hooks/use-hydrated"
import { cn } from "@qticaret/ui/lib/utils"
import type { GalleryWords } from "./words"

/** Thumbnails a row shows at once (three on a narrow phone, `pages.css`). */
const VISIBLE = 4

const smooth = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"

/**
 * The gallery's thumbnails under the main photograph, four at once (three
 * on a narrow phone), the one shown outlined. Each is an anchor to its
 * slide before the script; with it, a press swaps the main photograph.
 * More than four: the row slides (a swipe, or the two slim arrows beside
 * it, a page at a time), and it keeps the photograph shown in view.
 */
export function Thumbs({
  images,
  index,
  slideId,
  onChoose,
  words,
}: {
  images: ImageView[]
  index: number
  slideId: (n: number) => string
  onChoose: (n: number) => void
  words: GalleryWords
}) {
  const row = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })
  const hydrated = useHydrated()
  const sliding = images.length > VISIBLE

  // Which ends the row can still slide towards (a swipe, an arrow, a resize)
  useEffect(() => {
    const list = row.current
    if (!list) {
      return
    }
    const measure = () => {
      const left = Math.abs(list.scrollLeft)
      setEdges({ start: left < 2, end: left + list.clientWidth >= list.scrollWidth - 2 })
    }
    measure()
    const resized = new ResizeObserver(measure)
    resized.observe(list)
    list.addEventListener("scroll", measure, { passive: true })
    return () => {
      resized.disconnect()
      list.removeEventListener("scroll", measure)
    }
  }, [])

  // The photograph shown stays in view in the row (its own scroll, never the page's)
  useEffect(() => {
    const list = row.current
    const item = list?.children[index] as HTMLElement | undefined
    if (!list || !item) {
      return
    }
    // Measured from the row's own edges, its 4 px padding kept
    const box = list.getBoundingClientRect()
    const own = item.getBoundingClientRect()
    if (own.left < box.left + 4) {
      list.scrollBy({ left: own.left - box.left - 4, behavior: smooth() })
    } else if (own.right > box.right - 4) {
      list.scrollBy({ left: own.right - box.right + 4, behavior: smooth() })
    }
  }, [index])

  const slide = (by: number) => {
    const list = row.current
    list?.scrollBy({ left: by * list.clientWidth, behavior: smooth() })
  }

  const arrow = (side: "start" | "end") => {
    if (!sliding) {
      return null
    }
    if (!hydrated) {
      return <span aria-hidden="true" />
    }
    const Icon = side === "start" ? ChevronLeft : ChevronRight
    return (
      <button
        type="button"
        className="gf-thumbs-arrow"
        aria-label={side === "start" ? words.thumbsPrevious : words.thumbsNext}
        aria-controls="gorsel-kucukleri"
        disabled={edges[side]}
        onClick={() => {
          slide(side === "start" ? -1 : 1)
        }}
      >
        <Icon className="size-5" aria-hidden="true" strokeWidth={2} />
      </button>
    )
  }

  return (
    <div
      className={cn("grid items-stretch gap-1.5", sliding && "grid-cols-[2rem_minmax(0,1fr)_2rem]")}
    >
      {arrow("start")}
      <ul ref={row} id="gorsel-kucukleri" className="gf-thumbs">
        {images.map((image, n) => (
          <li key={image.src}>
            <a
              href={`#${slideId(n + 1)}`}
              aria-current={n === index ? "true" : undefined}
              aria-label={words.show.replace("{n}", String(n + 1))}
              onClick={(event) => {
                event.preventDefault()
                onChoose(n)
              }}
              className={cn(
                "relative block aspect-square overflow-hidden rounded-inner bg-paper-2 outline-offset-2 transition-opacity duration-(--dur-micro)",
                n === index ? "outline-2 outline-text" : "opacity-70 hover:opacity-100"
              )}
            >
              <ResponsiveImage
                image={{ ...image, alt: "" }}
                sizes="(min-width: 768px) 128px, 25vw"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </a>
          </li>
        ))}
      </ul>
      {arrow("end")}
    </div>
  )
}
