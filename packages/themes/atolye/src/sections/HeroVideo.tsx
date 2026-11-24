"use client"

import { Play, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useState } from "react"
import { heroVideoPlayerSrc } from "@qticaret/types/hero-video"
import type { HeroVideoView } from "@qticaret/ui"
import { LayerPortal } from "../frame/Layers"
import type { HeroVideoWords } from "./hero-video-words"

/**
 * The full image opening's video button: a quiet button with a play mark
 * and the shop's words (or "Videoyu izle"), and on a press a lightbox on
 * graphite with the player at 16:9 (a labelled dialog: the focus held in
 * it, Escape, the 44 px button or a press beside it close it, and the
 * focus goes back to the button). Nothing of the player's is asked for
 * before the press: the frame is only in the page while the lightbox is
 * open, its address built from the video's host and id alone (YouTube's
 * privacy-enhanced player, Vimeo's without tracking). A video the player
 * cannot take draws no button.
 */
export function HeroVideo({ video, words }: { video: HeroVideoView; words: HeroVideoWords }) {
  const [open, setOpen] = useState(false)
  const src = heroVideoPlayerSrc(video)
  if (src === null) {
    return null
  }
  const name = words[video.host]
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="gf-btn gf-btn--quiet">
        <Play className="size-5 shrink-0" aria-hidden="true" strokeWidth={2} />
        <span>{video.label ?? words.play}</span>
      </Dialog.Trigger>
      <LayerPortal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-stage/90 duration-(--dur-short) motion-safe:data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="gf-stage fixed inset-0 z-(--z-modal) m-auto flex h-fit w-[min(calc(100%_-_2rem),calc((100dvh_-_6rem)*16/9))] max-w-6xl flex-col gap-3 bg-transparent outline-none"
        >
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title className="max-w-none truncate text-sm font-semibold tracking-normal text-stage-text-2">
              {name}
            </Dialog.Title>
            <Dialog.Close className="gf-icon-btn shrink-0 bg-stage-2" aria-label={words.close}>
              <X className="size-5" aria-hidden="true" strokeWidth={2} />
            </Dialog.Close>
          </div>
          <div className="relative aspect-video w-full overflow-hidden rounded-tile bg-stage">
            <iframe
              src={src}
              title={name}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </Dialog.Content>
      </LayerPortal>
    </Dialog.Root>
  )
}
