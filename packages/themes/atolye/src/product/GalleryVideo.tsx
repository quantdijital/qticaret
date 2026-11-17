"use client"

import { Pause, Play } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ProductVideoView } from "@qticaret/ui"
import { useHydrated } from "@qticaret/ui/hooks/use-hydrated"
import { cn } from "@qticaret/ui/lib/utils"
import type { GalleryWords } from "./words"

/** Seen this much of the tile (adr/0069 §7), a clip plays by itself; less, it pauses. */
export const IN_VIEW = 0.5

/**
 * Whether the visitor asked for less on this device: reduced motion, or
 * the browser's data saver (`navigator.connection.saveData`, where the
 * browser has it). Then nothing plays by itself.
 */
export function autoplayRefused(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches || connection?.saveData === true
  )
}

/**
 * A short clip of the shop's in the gallery (adr/0069 §7): the same square
 * as a photograph (nothing moves when it loads), its poster first, lazy
 * unless it is the gallery's only kind of tile. Nothing of the clip loads
 * before it is half in view: then its sources (WebM, then MP4) are attached
 * and it plays, muted and looping; out of view it pauses. Reduced motion,
 * the data saver, a clip that must not start by itself (`autoplay` false: a
 * product without photographs, the poster is its first picture) or a
 * browser that refuses to play it: the poster stays, with the button. The
 * play/pause button is always there (WCAG 2.2.2), named after the clip.
 */
export function GalleryVideo({
  video,
  sizes,
  priority = false,
  autoplay = true,
  words,
}: {
  video: ProductVideoView
  sizes: string
  /** The page's largest picture: its poster loads at once (a product without photographs). */
  priority?: boolean
  /** Whether it may start by itself once in view. */
  autoplay?: boolean
  words: GalleryWords
}) {
  const tile = useRef<HTMLDivElement>(null)
  const player = useRef<HTMLVideoElement>(null)
  // Stopped by the shopper (or refused by the browser): it does not start by itself again
  const held = useRef(false)
  // Attached and to be played once the sources are in the page
  const pending = useRef(false)
  const [attached, setAttached] = useState(false)
  const [playing, setPlaying] = useState(false)
  // A first frame drawn: the clip covers its poster from then on
  const [shown, setShown] = useState(false)
  const hydrated = useHydrated()
  const sources = video.sources

  const play = () => {
    const element = player.current
    if (!element) {
      return
    }
    element.muted = true
    Promise.resolve(element.play()).then(
      () => {
        setShown(true)
        setPlaying(true)
      },
      (error: unknown) => {
        // The browser said no (autoplay off, a power saver): the poster and the button, quietly.
        // Paused before it began (scrolled past at once) is no refusal: it may start next time
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          held.current = true
        }
        setPlaying(false)
      }
    )
  }

  const start = () => {
    if (attached) {
      play()
    } else {
      pending.current = true
      setAttached(true)
    }
  }

  const stop = () => {
    player.current?.pause()
    setPlaying(false)
  }

  // The sources just attached: the clip loads them now, then plays
  const attachedNow = useEffectEvent(() => {
    if (pending.current) {
      pending.current = false
      player.current?.load()
      play()
    }
  })
  useEffect(() => {
    if (attached) {
      attachedNow()
    }
  }, [attached])

  // Half in view it plays by itself (when it may), out of view it pauses
  const seenNow = useEffectEvent((inView: boolean, may: boolean) => {
    if (inView) {
      if (may && !held.current) {
        start()
      }
    } else if (player.current && !player.current.paused) {
      stop()
    }
  })
  useEffect(() => {
    const box = tile.current
    if (!box || !sources) {
      return
    }
    const may = autoplay && !autoplayRefused()
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          seenNow(entry.isIntersecting && entry.intersectionRatio >= IN_VIEW, may)
        }
      },
      { threshold: [0, IN_VIEW] }
    )
    seen.observe(box)
    return () => {
      seen.disconnect()
    }
  }, [autoplay, sources])

  // A function: the shop's title is put in as written (`$&`, `$'` are not patterns here)
  const named = (playing ? words.videoPauseNamed : words.videoPlayNamed).replace(
    "{title}",
    () => video.title
  )
  return (
    <div ref={tile} className="absolute inset-0" data-video={video.id}>
      <ResponsiveImage
        image={video.poster}
        sizes={sizes}
        priority={priority}
        className="absolute inset-0 h-full w-full object-contain"
      />
      {sources && (
        <video
          ref={player}
          muted
          playsInline
          loop
          preload="none"
          disablePictureInPicture
          aria-hidden="true"
          // Paused by the browser itself (a background tab, the system): the button says so
          onPause={() => {
            setPlaying(false)
          }}
          className={cn(
            "absolute inset-0 h-full w-full object-contain",
            shown ? "opacity-100" : "opacity-0"
          )}
        >
          {attached && (
            <>
              {sources.webm && <source src={sources.webm} type="video/webm" />}
              <source src={sources.mp4} type="video/mp4" />
            </>
          )}
        </video>
      )}
      {hydrated && sources && (
        <button
          type="button"
          aria-label={named}
          className="absolute right-3 bottom-3 inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-pill bg-stage/80 px-3 text-sm font-semibold text-stage-text hover:bg-stage-2 focus-visible:outline-signal-on-stage"
          onClick={(event) => {
            // The tile's own press (the gallery's) is not this one's
            event.stopPropagation()
            if (playing) {
              held.current = true
              stop()
            } else {
              held.current = false
              start()
            }
          }}
        >
          {playing ? (
            <Pause className="size-5" aria-hidden="true" strokeWidth={2} />
          ) : (
            <>
              <Play className="size-5" aria-hidden="true" strokeWidth={2} />
              <span>{words.videoPlay}</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
