"use client"

import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

// The large photo: the dialog's half from 768 px (at most 448 px), two thirds of a phone
const SIZES = "(min-width: 768px) 448px, 66vw"

/**
 * The quick view's photos (adr/0049 Ek 2026-11-15): the shown one large
 * in the card's well at the shop's ratio (its box sized before it loads:
 * nothing moves), then each as a 56 px thumbnail button, the shown one
 * ringed (`aria-pressed`). One photo: no thumbnails. None: the empty well.
 */
export function QuickViewGallery({
  images,
  shown,
  show,
  words,
}: {
  images: readonly ImageView[]
  shown: number
  show: (index: number) => void
  words: { pictures: string; picture: string }
}) {
  const image = images[shown] ?? images[0] ?? null
  return (
    <div className="flex flex-col gap-3">
      <div className="relative mx-auto aspect-card w-2/3 overflow-hidden rounded-media bg-paper-2 md:w-full">
        {image && (
          <ResponsiveImage
            key={image.src}
            image={image}
            sizes={SIZES}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      {images.length > 1 && (
        <ul
          aria-label={words.pictures}
          className="flex flex-wrap justify-center gap-2 md:justify-start"
        >
          {images.map((each, index) => (
            <li key={each.src}>
              <button
                type="button"
                aria-pressed={index === shown}
                aria-label={words.picture.replace("{number}", String(index + 1))}
                onClick={() => {
                  show(index)
                }}
                className={cn(
                  "block size-14 overflow-hidden rounded-inner bg-paper-2 ring-2 ring-transparent ring-offset-2 ring-offset-paper transition-shadow duration-(--dur-micro) hover:ring-edge",
                  index === shown && "ring-text hover:ring-text"
                )}
              >
                <ResponsiveImage
                  image={{ ...each, alt: "" }}
                  sizes="56px"
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
