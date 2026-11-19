"use client"

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import type { ScrollerStep, SliderSettings } from "@qticaret/types"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A control's field mark in the editor's preview, as `@qticaret/ui`'s
 * `fieldMark` writes it (adr/0065 Faz 2b; the package's root is not
 * pulled into the client bundle): the kit's setting it opens; nothing
 * on a live page.
 */
const fieldMark = (on: boolean | undefined, key: string): { "data-qf"?: string } =>
  on ? { "data-qf": key } : {}

/** The carousel's words, in the shopper's language (the server's `t`, `sliderWords`). */
export interface SliderWords {
  label: string
  previous: string
  next: string
  play: string
  pause: string
  /** The dots' group ("Slayt seçimi"). */
  picker: string
  /** Each slide's name ("1 / 4"). */
  slides: string[]
  /** Each dot's name ("1. slayta geç"). */
  goTo: string[]
}

/** The controls' own look (the kit's slider steps); their defaults are the look before them. */
export type SliderLook = Pick<
  SliderSettings,
  "play_button" | "dot_style" | "controls_place" | "arrow_size" | "controls_tone"
>

type Tone = ScrollerStep<"controls_tone">

const ARROW =
  "gf-slider-arrow absolute top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center transition-[color,background-color,opacity] disabled:cursor-default disabled:opacity-35 lg:inline-flex"

const SIZE: Readonly<Record<ScrollerStep<"arrow_size">, { box: string; icon: string }>> = {
  small: { box: "size-10", icon: "size-5" },
  medium: { box: "size-12", icon: "size-6" },
  large: { box: "size-14", icon: "size-7" },
}

/**
 * The arrows' shape, the scroller kit's steps: round whatever the shop's
 * button shape (a round arrow is a circle), square, or a bare chevron.
 */
const SHAPE: Readonly<Record<ScrollerStep<"arrow_style">, string>> = {
  round: "rounded-full",
  square: "rounded-(--radius-inner)",
  plain: "text-stage-text drop-shadow-[0_1px_2px_rgb(0_0_0/0.65)] enabled:hover:text-stage-text-2",
}

/** A round or square arrow's ground: the graphite (as before), a light one, the shop's colour. */
const GROUND: Readonly<Record<Tone, string>> = {
  dark: "bg-stage/70 text-stage-text enabled:hover:bg-stage",
  light: "bg-field/85 text-text enabled:hover:bg-field",
  brand: "bg-signal text-signal-ink enabled:hover:bg-signal-deep",
}

/** The pill under the slides, by its ground. */
const PILL: Readonly<Record<Tone, string>> = {
  dark: "bg-stage/70 text-stage-text backdrop-blur-sm",
  light: "bg-field/85 text-text backdrop-blur-sm",
  brand: "bg-signal text-signal-ink",
}

/** A pill holding only a hidden pause button: its ground shows once the keyboard reaches it. */
const BARE_PILL: Readonly<Record<Tone, string>> = {
  dark: "text-stage-text has-focus-visible:bg-stage/70",
  light: "text-text has-focus-visible:bg-field/85",
  brand: "text-signal-ink has-focus-visible:bg-signal",
}

/** A dot's ink: the one in view, the others. */
const INK: Readonly<Record<Tone, { on: string; off: string }>> = {
  dark: { on: "bg-stage-text", off: "bg-stage-text/45 group-hover:bg-stage-text/80" },
  light: { on: "bg-text", off: "bg-text/35 group-hover:bg-text/70" },
  brand: { on: "bg-signal-ink", off: "bg-signal-ink/50 group-hover:bg-signal-ink/80" },
}

const PLACE: Readonly<Record<ScrollerStep<"controls_place">, string>> = {
  center: "justify-center",
  start: "justify-start px-4 sm:px-5",
  end: "justify-end px-4 sm:px-5",
}

/**
 * Two arrows either side of the slide, from 1024 px; past the last is the
 * first unless the slider does not loop (then each is off at its end).
 */
export function SliderArrows({
  words,
  shape,
  look,
  marks,
  atStart,
  atEnd,
  onStep,
}: {
  words: SliderWords
  shape: ScrollerStep<"arrow_style">
  look: SliderLook
  /** The theme editor's preview: the arrows carry their field mark (adr/0065 Faz 2b). */
  marks?: boolean | undefined
  atStart: boolean
  atEnd: boolean
  onStep: (by: -1 | 1) => void
}) {
  const size = SIZE[look.arrow_size]
  const className = cn(
    ARROW,
    size.box,
    SHAPE[shape],
    shape === "plain" ? null : GROUND[look.controls_tone]
  )
  const mark = fieldMark(marks, "scroller.arrows")
  return (
    <>
      <button
        type="button"
        aria-label={words.previous}
        className={cn(className, "left-4")}
        disabled={atStart}
        onClick={() => {
          onStep(-1)
        }}
        {...mark}
      >
        <ChevronLeft aria-hidden="true" className={size.icon} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label={words.next}
        className={cn(className, "right-4")}
        disabled={atEnd}
        onClick={() => {
          onStep(1)
        }}
        {...mark}
      >
        <ChevronRight aria-hidden="true" className={size.icon} strokeWidth={1.75} />
      </button>
    </>
  )
}

/** The slides' picker in the shop's style: a dot or a line each, "2 / 4", or a bar filled to the slide. */
function Picker({
  words,
  count,
  index,
  look,
  onPick,
}: {
  words: SliderWords
  count: number
  index: number
  look: SliderLook
  onPick: (at: number) => void
}) {
  const style = look.dot_style
  if (style === "count") {
    // The rail already says which slide is in view: the count is for the eye
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-11 items-center px-3 text-sm font-semibold tabular-nums"
      >
        {words.slides[index]}
      </span>
    )
  }
  const ink = INK[look.controls_tone]
  return Array.from({ length: count }, (_, at) => (
    <button
      key={at}
      type="button"
      aria-label={words.goTo[at]}
      aria-current={at === index ? "true" : undefined}
      className={
        style === "progress"
          ? "group inline-flex h-11 w-9 items-center px-0.5 pointer-fine:w-7"
          : "group inline-flex h-11 min-w-11 items-center justify-center pointer-fine:min-w-7"
      }
      onClick={() => {
        onPick(at)
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "rounded-pill transition-colors",
          style === "dots" && (at === index ? "h-2 w-6" : "h-2 w-2"),
          style === "lines" && "h-1 w-5",
          style === "progress" && "h-1 w-full",
          (style === "progress" ? at <= index : at === index) ? ink.on : ink.off
        )}
      />
    </button>
  ))
}

/**
 * Under the slides in a translucent pill (in the middle unless the shop
 * moved it): the pause (or play) button while the shop turned autoplay
 * on, then the slides' picker; 44 px targets on touch, 28 px with a
 * mouse. A pause button the shop hid stays for the keyboard: out of
 * sight until it has the focus (WCAG 2.2.2; the pointer and the focus
 * hold the slides anyway).
 */
export function SliderDots({
  words,
  count,
  index,
  dots,
  look,
  marks,
  playControl,
  playing,
  onPick,
  onPlay,
}: {
  words: SliderWords
  count: number
  index: number
  dots: boolean
  look: SliderLook
  /** The theme editor's preview: the picker and the pause button carry their field marks. */
  marks?: boolean | undefined
  playControl: boolean
  playing: boolean
  onPick: (at: number) => void
  onPlay: () => void
}) {
  const playShown = look.play_button === "on"
  const bare = !dots && !playShown
  const picks = look.dot_style !== "count"
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-3 z-10 flex sm:bottom-5",
        PLACE[look.controls_place]
      )}
    >
      <div
        className={cn(
          "flex items-center rounded-button px-1",
          bare ? BARE_PILL[look.controls_tone] : PILL[look.controls_tone]
        )}
      >
        {playControl && (
          <button
            type="button"
            aria-label={playing ? words.pause : words.play}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-button",
              !playShown && "sr-only focus-visible:not-sr-only"
            )}
            onClick={onPlay}
            {...fieldMark(marks && playShown, "scroller.play_button")}
          >
            {playing ? (
              <Pause aria-hidden="true" className="size-4" strokeWidth={2} />
            ) : (
              <Play aria-hidden="true" className="size-4" strokeWidth={2} />
            )}
          </button>
        )}
        {dots && (
          <div
            role={picks ? "group" : undefined}
            aria-label={picks ? words.picker : undefined}
            className="flex items-center"
            {...fieldMark(marks, "scroller.dots")}
          >
            <Picker words={words} count={count} index={index} look={look} onPick={onPick} />
          </div>
        )}
      </div>
    </div>
  )
}
