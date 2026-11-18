"use client"

import { Play } from "lucide-react"
import { useEffect, useRef } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import type { GalleryWords } from "./words"

const smooth = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"

/**
 * The gallery's thumbnails under the main photograph, four at once (three
 * on a narrow phone), the one shown outlined. Each is an anchor to its
 * slide before the script; with it, a press swaps the main photograph.
 * More than four: the row slides by a swipe, a scroll or the keyboard (no
 * arrows of its own, the main photograph has them; sahip 2026-11-18), and
 * it keeps the photograph shown in view. A video's square (adr/0069 §7)
 * shows its poster with a play mark.
 */
export function Thumbs({
  images,
  videos = {},
  index,
  slideId,
  onChoose,
  words,
}: {
  images: ImageView[]
  /** The squares that are videos, by their place in `images` (their posters): each one's title. */
  videos?: Readonly<Record<number, string>>
  index: number
  slideId: (n: number) => string
  onChoose: (n: number) => void
  words: GalleryWords
}) {
  const row = useRef<HTMLUListElement>(null)

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

  return (
    <ul ref={row} id="gorsel-kucukleri" className="gf-thumbs">
      {images.map((image, n) => (
        <li key={image.src}>
          <a
            href={`#${slideId(n + 1)}`}
            aria-current={n === index ? "true" : undefined}
            aria-label={
              videos[n] === undefined
                ? words.show.replace("{n}", String(n + 1))
                : // A function: the title as written (`$&`, `$'` are not patterns here)
                  words.videoShow.replace("{title}", () => videos[n] ?? "")
            }
            onClick={(event) => {
              event.preventDefault()
              onChoose(n)
            }}
            className={cn(
              "relative block aspect-square overflow-hidden rounded-inner bg-media outline-offset-2 transition-opacity duration-(--dur-micro)",
              n === index ? "outline-2 outline-text" : "opacity-70 hover:opacity-100"
            )}
          >
            <ResponsiveImage
              image={{ ...image, alt: "" }}
              sizes="(min-width: 768px) 128px, 25vw"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {videos[n] !== undefined && (
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center"
                data-video-mark=""
              >
                <span className="flex size-8 items-center justify-center rounded-pill bg-stage/80 text-stage-text">
                  <Play className="size-4" aria-hidden="true" strokeWidth={2} />
                </span>
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  )
}
