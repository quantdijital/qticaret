"use client"

import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useHydrated } from "@qticaret/ui/hooks/use-hydrated"
import type { ScrollerStep } from "@qticaret/types"
import { cn } from "@qticaret/ui/lib/utils"
import { SliderArrows, SliderDots, type SliderWords } from "./SliderControls"
import { type PlayChoice, isPlaying, wrapIndex } from "./slider-play"

export type { SliderWords } from "./SliderControls"

const REDUCED = "(prefers-reduced-motion: reduce)"
const reduced = () => window.matchMedia(REDUCED).matches
const watchMotion = (change: () => void) => {
  const query = window.matchMedia(REDUCED)
  query.addEventListener("change", change)
  return () => {
    query.removeEventListener("change", change)
  }
}

/**
 * The slider's stage (WAI-ARIA APG carousel): a rail that snaps, one slide
 * wide, so a phone swipes it and a keyboard scrolls it; from 1024 px two
 * arrows (always, or while the pointer is over it; round, square or bare,
 * the scroller kit's steps); dots under the slides; a pause button whenever
 * the shop turned autoplay on. Past the last slide is the first unless the
 * shop turned looping off: then the arrows stop at either end and the
 * autoplay at the last slide. Autoplay starts only if the visitor does not ask
 * for reduced motion, waits while the pointer or the focus is on the
 * stage or the tab is hidden, and stops for good once the visitor steps
 * on their own (arrow, dot, swipe, keys) or presses pause. Only the slide
 * in view is reachable (the others `inert`); the rail announces a slide
 * change politely unless it plays. Controls appear once the script runs:
 * the HTML without script is a rail that scrolls.
 */
export function SliderStage({
  words,
  autoplay,
  interval,
  dots,
  arrows,
  arrowStyle,
  loop,
  focusable,
  children,
}: {
  words: SliderWords
  autoplay: boolean
  /** Seconds a slide stays while it plays. */
  interval: number
  dots: boolean
  /** When the arrows show (from 1024 px): always, while the pointer is over the stage, never. */
  arrows: ScrollerStep<"arrows">
  arrowStyle: ScrollerStep<"arrow_style">
  /** Past the last slide is the first. */
  loop: boolean
  /** A slide without a link: the rail itself takes the focus so its keys scroll it. */
  focusable: boolean
  children: ReactNode
}) {
  const rail = useRef<HTMLDivElement>(null)
  // The slide a step scrolls to, until the rail is there
  const heading = useRef<number | null>(null)
  const slides = Children.toArray(children)
  const count = slides.length
  const hydrated = useHydrated()
  const [index, setIndex] = useState(0)
  // The rail is between slides (a swipe, a step): its neighbours are in sight meanwhile
  const [moving, setMoving] = useState(false)
  // The visitor's own word on the autoplay: none yet, play, or stop (for good)
  const [choice, setChoice] = useState<PlayChoice>(null)
  const still = useSyncExternalStore(watchMotion, reduced, () => true)
  const playing = isPlaying({ autoplay, count, choice, hydrated, reducedMotion: still })
  // Held while the pointer or the focus is on the stage, the tab is hidden, or the theme
  // editor has its section selected (adr/0065 §2, `qt:section:select`)
  const [held, setHeld] = useState({ pointer: false, focus: false, hidden: false, editing: false })

  const goTo = useCallback(
    (to: number) => {
      const list = rail.current
      if (!list || count === 0) {
        return
      }
      const next = loop ? wrapIndex(to, count) : Math.min(count - 1, Math.max(0, to))
      // The rail passes other slides on its way: they are not where it goes
      heading.current = Math.round(list.scrollLeft / list.clientWidth) === next ? null : next
      setMoving(heading.current !== null)
      list.scrollTo({ left: next * list.clientWidth, behavior: reduced() ? "auto" : "smooth" })
      setIndex(next)
    },
    [count, loop]
  )

  // The slide in view follows the rail (a swipe, a key, a step)
  useEffect(() => {
    const list = rail.current
    if (!list || count < 2) {
      return
    }
    let frame = 0
    const follow = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const width = list.clientWidth
        if (width > 0) {
          const at = Math.min(count - 1, Math.max(0, Math.round(list.scrollLeft / width)))
          if (heading.current === null || heading.current === at) {
            heading.current = null
            setIndex(at)
          }
          // Snapped to a slide: the others step out of sight again
          if (Math.abs(list.scrollLeft - at * width) < 2 && heading.current === null) {
            setMoving(false)
          }
        }
      })
    }
    list.addEventListener("scroll", follow, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      list.removeEventListener("scroll", follow)
    }
  }, [count])

  // A hidden tab holds the autoplay
  useEffect(() => {
    const seen = () => {
      setHeld((was) => ({ ...was, hidden: document.visibilityState === "hidden" }))
    }
    document.addEventListener("visibilitychange", seen)
    return () => {
      document.removeEventListener("visibilitychange", seen)
    }
  }, [])

  // The theme editor's preview only: its section selected, the slider holds still
  useEffect(() => {
    const section = rail.current?.closest("[data-qs]")
    if (!section) {
      return
    }
    const hold = (editing: boolean) => (event: Event) => {
      if (event.target === section) {
        setHeld((was) => ({ ...was, editing }))
      }
    }
    const select = hold(true)
    const deselect = hold(false)
    // A slider just added is selected before this listens: the editor's mark says so
    if (section.hasAttribute("data-qt-selected")) {
      setHeld((was) => ({ ...was, editing: true }))
    }
    section.addEventListener("qt:section:select", select)
    section.addEventListener("qt:section:deselect", deselect)
    return () => {
      section.removeEventListener("qt:section:select", select)
      section.removeEventListener("qt:section:deselect", deselect)
    }
  }, [])

  // Not looping: the autoplay ends on the last slide
  const atEnd = !loop && index >= count - 1
  const running = playing && !atEnd && !held.pointer && !held.focus && !held.hidden && !held.editing
  useEffect(() => {
    if (!running) {
      return
    }
    const timer = window.setTimeout(() => {
      goTo(index + 1)
    }, interval * 1000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [running, index, interval, goTo])

  /** The visitor's own step: the autoplay stops for good. */
  const step = (to: number) => {
    setChoice("stop")
    goTo(to)
  }
  const stop = () => {
    setChoice("stop")
  }

  const controls = hydrated && count > 1
  return (
    <div
      className="gf-stage relative overflow-hidden rounded-tile"
      data-arrows={arrows}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          setHeld((was) => ({ ...was, pointer: true }))
        }
      }}
      onPointerLeave={() => {
        setHeld((was) => ({ ...was, pointer: false }))
      }}
      onFocus={() => {
        setHeld((was) => ({ ...was, focus: true }))
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHeld((was) => ({ ...was, focus: false }))
        }
      }}
    >
      <div
        ref={rail}
        aria-live={running ? "off" : "polite"}
        tabIndex={focusable && count > 1 ? 0 : undefined}
        aria-label={focusable && count > 1 ? words.label : undefined}
        role={focusable && count > 1 ? "group" : undefined}
        className="gf-rail flex overflow-x-auto"
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") {
            heading.current = null
            setMoving(true)
            stop()
          }
        }}
        onWheel={(event) => {
          if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            heading.current = null
            setMoving(true)
            stop()
          }
        }}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && event.key.startsWith("Arrow")) {
            heading.current = null
            setMoving(true)
            stop()
          }
        }}
      >
        {slides.map((slide, at) => (
          <div
            key={at}
            role="group"
            aria-roledescription="slide"
            aria-label={words.slides[at]}
            inert={hydrated && at !== index}
            className={cn(
              "w-full shrink-0 snap-start snap-always",
              // Out of sight once settled: only the slide in view is drawn and read
              hydrated && !moving && at !== index && "invisible"
            )}
          >
            {slide}
          </div>
        ))}
      </div>
      {controls && arrows !== "hidden" && (
        <SliderArrows
          words={words}
          shape={arrowStyle}
          atStart={!loop && index === 0}
          atEnd={atEnd}
          onStep={(by) => {
            step(index + by)
          }}
        />
      )}
      {controls && (dots || autoplay) && (
        <SliderDots
          words={words}
          count={count}
          index={index}
          dots={dots}
          playControl={autoplay}
          playing={playing && !atEnd}
          onPick={step}
          onPlay={() => {
            setChoice(playing ? "stop" : "play")
            setHeld((was) => ({ ...was, pointer: false, focus: false }))
          }}
        />
      )}
    </div>
  )
}
