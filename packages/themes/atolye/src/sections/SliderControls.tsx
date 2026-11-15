"use client"

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import type { ScrollerStep } from "@qticaret/types"
import { cn } from "@qticaret/ui/lib/utils"

/** The carousel's words, in the shopper's language (the server's `t`). */
export interface SliderWords {
  label: string
  previous: string
  next: string
  play: string
  pause: string
  /** Each slide's name ("1 / 4"). */
  slides: string[]
  /** Each dot's name ("1. slayta geç"). */
  goTo: string[]
}

const ARROW =
  "gf-slider-arrow absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center text-stage-text transition-[color,background-color,opacity] disabled:cursor-default disabled:opacity-35 lg:inline-flex"

/** The arrows' shape, the scroller kit's steps: the graphite round (as before), square or bare. */
const SHAPE: Readonly<Record<ScrollerStep<"arrow_style">, string>> = {
  round: "rounded-button bg-stage/70 enabled:hover:bg-stage",
  square: "rounded-(--radius-inner) bg-stage/70 enabled:hover:bg-stage",
  plain: "drop-shadow-[0_1px_2px_rgb(0_0_0/0.65)] enabled:hover:text-stage-text-2",
}

/**
 * Two arrows either side of the slide, from 1024 px; past the last is the
 * first unless the slider does not loop (then each is off at its end).
 */
export function SliderArrows({
  words,
  shape,
  atStart,
  atEnd,
  onStep,
}: {
  words: SliderWords
  shape: ScrollerStep<"arrow_style">
  atStart: boolean
  atEnd: boolean
  onStep: (by: -1 | 1) => void
}) {
  return (
    <>
      <button
        type="button"
        aria-label={words.previous}
        className={cn(ARROW, SHAPE[shape], "left-4")}
        disabled={atStart}
        onClick={() => {
          onStep(-1)
        }}
      >
        <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label={words.next}
        className={cn(ARROW, SHAPE[shape], "right-4")}
        disabled={atEnd}
        onClick={() => {
          onStep(1)
        }}
      >
        <ChevronRight aria-hidden="true" className="size-6" strokeWidth={1.75} />
      </button>
    </>
  )
}

/**
 * Under the slides in a translucent graphite pill: the pause (or play)
 * button while the shop turned autoplay on, then a dot a slide, the one
 * in view a longer line; 44 px targets on touch, 28 px with a mouse.
 */
export function SliderDots({
  words,
  count,
  index,
  dots,
  playControl,
  playing,
  onPick,
  onPlay,
}: {
  words: SliderWords
  count: number
  index: number
  dots: boolean
  playControl: boolean
  playing: boolean
  onPick: (at: number) => void
  onPlay: () => void
}) {
  return (
    <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center sm:bottom-5">
      <div className="flex items-center rounded-button bg-stage/70 px-1 text-stage-text backdrop-blur-sm">
        {playControl && (
          <button
            type="button"
            aria-label={playing ? words.pause : words.play}
            className="inline-flex size-11 items-center justify-center rounded-button"
            onClick={onPlay}
          >
            {playing ? (
              <Pause aria-hidden="true" className="size-4" strokeWidth={2} />
            ) : (
              <Play aria-hidden="true" className="size-4" strokeWidth={2} />
            )}
          </button>
        )}
        {dots &&
          Array.from({ length: count }, (_, at) => (
            <button
              key={at}
              type="button"
              aria-label={words.goTo[at]}
              aria-current={at === index ? "true" : undefined}
              className="group inline-flex h-11 min-w-11 items-center justify-center pointer-fine:min-w-7"
              onClick={() => {
                onPick(at)
              }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 rounded-pill transition-colors",
                  at === index
                    ? "w-6 bg-stage-text"
                    : "w-2 bg-stage-text/45 group-hover:bg-stage-text/80"
                )}
              />
            </button>
          ))}
      </div>
    </div>
  )
}
