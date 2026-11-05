"use client"

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
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
import { cn } from "@qticaret/ui/lib/utils"
import { type PlayChoice, isPlaying, wrapIndex } from "./slider-play"

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
 * round arrows; dots under the slides; a pause button whenever the shop
 * turned autoplay on. Autoplay starts only if the visitor does not ask
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
  focusable,
  children,
}: {
  words: SliderWords
  autoplay: boolean
  /** Seconds a slide stays while it plays. */
  interval: number
  dots: boolean
  arrows: boolean
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
  // Held while the pointer or the focus is on the stage, or the tab is hidden
  const [held, setHeld] = useState({ pointer: false, focus: false, hidden: false })

  const goTo = useCallback(
    (to: number) => {
      const list = rail.current
      if (!list || count === 0) {
        return
      }
      const next = wrapIndex(to, count)
      // The rail passes other slides on its way: they are not where it goes
      heading.current = Math.round(list.scrollLeft / list.clientWidth) === next ? null : next
      setMoving(heading.current !== null)
      list.scrollTo({ left: next * list.clientWidth, behavior: reduced() ? "auto" : "smooth" })
      setIndex(next)
    },
    [count]
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

  const running = playing && !held.pointer && !held.focus && !held.hidden
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
  const round =
    "absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-pill bg-stage/70 text-stage-text transition-colors hover:bg-stage lg:inline-flex"
  return (
    <div
      className="gf-stage relative overflow-hidden rounded-tile"
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
      {controls && arrows && (
        <>
          <button
            type="button"
            aria-label={words.previous}
            className={cn(round, "left-4")}
            onClick={() => {
              step(index - 1)
            }}
          >
            <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label={words.next}
            className={cn(round, "right-4")}
            onClick={() => {
              step(index + 1)
            }}
          >
            <ChevronRight aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </button>
        </>
      )}
      {controls && (dots || autoplay) && (
        <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center sm:bottom-5">
          <div className="flex items-center rounded-pill bg-stage/70 px-1 text-stage-text backdrop-blur-sm">
            {autoplay && (
              <button
                type="button"
                aria-label={playing ? words.pause : words.play}
                className="inline-flex size-11 items-center justify-center rounded-pill"
                onClick={() => {
                  setChoice(playing ? "stop" : "play")
                  setHeld((was) => ({ ...was, pointer: false, focus: false }))
                }}
              >
                {playing ? (
                  <Pause aria-hidden="true" className="size-4" strokeWidth={2} />
                ) : (
                  <Play aria-hidden="true" className="size-4" strokeWidth={2} />
                )}
              </button>
            )}
            {dots &&
              slides.map((_, at) => (
                <button
                  key={at}
                  type="button"
                  aria-label={words.goTo[at]}
                  aria-current={at === index ? "true" : undefined}
                  className="group inline-flex h-11 min-w-11 items-center justify-center pointer-fine:min-w-7"
                  onClick={() => {
                    step(at)
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
      )}
    </div>
  )
}
