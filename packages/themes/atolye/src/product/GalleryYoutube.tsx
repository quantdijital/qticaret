"use client"

import { Play } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { ProductVideoView } from "@qticaret/ui"
import { useHydrated } from "@qticaret/ui/hooks/use-hydrated"
import type { GalleryWords } from "./words"

/** The one player a YouTube video is framed from (the policy's `frame-src`, adr/0069 §8). */
const PLAYER = "https://www.youtube-nocookie.com/embed/"
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/**
 * The player's address once pressed: the privacy-enhanced embed, starting
 * at once, inline on phones, related videos from the same channel only.
 * Null for anything but that player's address with a video's id.
 */
export function youtubePlayerSrc(embedUrl: string): string | null {
  if (!embedUrl.startsWith(PLAYER)) {
    return null
  }
  const id = embedUrl.slice(PLAYER.length)
  return VIDEO_ID.test(id) ? `${PLAYER}${id}?autoplay=1&playsinline=1&rel=0` : null
}

/**
 * A YouTube video in the gallery (adr/0069 §7, §8): the same square as a
 * photograph (nothing moves when the player comes), its cover from the
 * shop's own storage, a "Videoyu oynat" button and one line saying the
 * video loads from YouTube. Nothing of YouTube's is asked for before the
 * press, the cover included: only then is the player framed, from its
 * privacy-enhanced address, and the focus moves into it.
 */
export function GalleryYoutube({
  video,
  sizes,
  priority = false,
  words,
}: {
  video: ProductVideoView
  sizes: string
  /** The page's largest picture: its cover loads at once (a product without photographs). */
  priority?: boolean
  words: GalleryWords
}) {
  const [playing, setPlaying] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const hydrated = useHydrated()
  const src = video.youtube ? youtubePlayerSrc(video.youtube.embedUrl) : null

  // Pressed: the player is in the page, the keyboard goes on inside it
  useEffect(() => {
    if (playing) {
      frame.current?.focus()
    }
  }, [playing])

  // A function: the shop's title is put in as written (`$&`, `$'` are not patterns here)
  const named = (pattern: string) => pattern.replace("{title}", () => video.title)
  if (playing && src) {
    return (
      <div className="absolute inset-0 bg-stage" data-video={video.id}>
        <iframe
          ref={frame}
          src={src}
          title={named(words.videoYoutubeFrame)}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    )
  }
  return (
    <div className="absolute inset-0" data-video={video.id}>
      <ResponsiveImage
        image={video.poster}
        sizes={sizes}
        priority={priority}
        className="absolute inset-0 h-full w-full object-contain"
      />
      {src && (
        // Above, where the zoom button would be (a video's square has none): the counter and
        // the play button keep the bottom
        <p className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] rounded-pill bg-stage/80 px-3 py-1 text-xs text-stage-text">
          {words.videoYoutubeNote}
        </p>
      )}
      {src && hydrated && (
        <button
          type="button"
          aria-label={named(words.videoPlayNamed)}
          className="absolute right-3 bottom-3 inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-pill bg-stage/80 px-3 text-sm font-semibold text-stage-text hover:bg-stage-2 focus-visible:outline-signal-on-stage"
          onClick={(event) => {
            // The tile's own press (the gallery's) is not this one's
            event.stopPropagation()
            setPlaying(true)
          }}
        >
          <Play className="size-5" aria-hidden="true" strokeWidth={2} />
          <span>{words.videoPlay}</span>
        </button>
      )}
    </div>
  )
}
