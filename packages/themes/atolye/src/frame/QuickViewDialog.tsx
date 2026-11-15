"use client"

import { X } from "lucide-react"
import { Dialog } from "radix-ui"
import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import type { QuickViewSetup, QuickViewView } from "@qticaret/ui"
import { loadQuickView, type QuickViewAnswer } from "@qticaret/ui/lib/quick-view"
import { CardRating } from "../parts/card-parts"
import { Summary } from "../product/Summary"
import { announceCartAdded, type QuickViewAsk } from "./events"
import { QuickViewBuy } from "./QuickViewBuy"
import { QuickViewGallery } from "./QuickViewGallery"
import type { QuickViewWords } from "./quick-view-words"

type Shown = QuickViewAnswer | { status: "loading" }

/** The gallery's photo a variant shows first: its own pictures' first, else the one shown. */
const pictureOf = (view: QuickViewView, variantId: string, current: number) =>
  view.variants.find((each) => each.id === variantId)?.images?.[0] ?? current

/** While the answer comes: the photo's well and the buy column's rows, at their sizes. */
function Skeleton({ words }: { words: QuickViewWords }) {
  const bar = "rounded-inner bg-paper-2 motion-safe:animate-pulse"
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <p className="sr-only">{words.loading}</p>
      <div className={`h-9 w-40 ${bar}`} />
      <div className={`h-5 w-full ${bar}`} />
      <div className={`h-5 w-3/4 ${bar}`} />
      <div className={`mt-2 h-12 w-full ${bar}`} />
    </div>
  )
}

/**
 * A card's quick view (adr/0049 Ek 2026-11-15): from 768 px a dialog in the
 * middle (at most 960 px, `rounded-tile`, one shadow), the photos on the
 * left and the buy column on the right; on a phone a sheet from the
 * bottom across the width (at most 92% of the screen), the photo above.
 * The product is asked once it opens (`loadQuickView`): meanwhile the name
 * the card gave and grey rows at their sizes; refused or missing, a line
 * and the product's page. The focus held inside, Escape, the scrim and a
 * 44 px button close it; the focus goes back to the card's button. Its
 * motion only for a shopper who has not asked for less. A line added
 * closes it, and the cart drawer opens to say so.
 */
export default function QuickViewDialog({
  ask,
  open,
  onOpenChange,
  opener,
  setup,
  words,
}: {
  ask: QuickViewAsk
  open: boolean
  onOpenChange: (open: boolean) => void
  opener: RefObject<HTMLElement | null>
  setup: QuickViewSetup
  words: QuickViewWords
}) {
  const [shown, setShown] = useState<Shown>({ status: "loading" })
  const [picture, setPicture] = useState(0)
  // Said by the cart drawer once this has closed and the focus is back on the card
  const added = useRef(false)
  useEffect(() => {
    if (!open) {
      return
    }
    const asking = new AbortController()
    void loadQuickView(setup.address, ask.productId, asking.signal).then((answer) => {
      if (asking.signal.aborted) {
        return
      }
      setShown(answer)
      if (answer.status === "ready" && answer.view.selectedVariantId) {
        setPicture(pictureOf(answer.view, answer.view.selectedVariantId, 0))
      }
    })
    return () => {
      asking.abort()
    }
  }, [open, ask.productId, setup.address])
  const view = shown.status === "ready" ? shown.view : null
  const onAdded = useCallback(() => {
    added.current = true
    onOpenChange(false)
  }, [onOpenChange])
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-scrim duration-(--dur-short) motion-safe:data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          data-quick-view-dialog=""
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            // Back to the card's button while it is on the page
            event.preventDefault()
            const back = opener.current
            if (back?.isConnected) {
              back.focus()
            }
            if (added.current) {
              added.current = false
              announceCartAdded(words.added)
            }
          }}
          className="fixed inset-x-0 bottom-0 z-(--z-modal) flex max-h-[92dvh] flex-col rounded-t-tile bg-paper text-text shadow-float outline-none duration-(--dur-short) motion-safe:data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in data-[state=open]:fade-in-0 max-md:motion-safe:data-[state=closed]:slide-out-to-bottom max-md:motion-safe:data-[state=open]:slide-in-from-bottom md:inset-0 md:m-auto md:h-fit md:max-h-[calc(100dvh-2rem)] md:w-[calc(100%-2rem)] md:max-w-240 md:rounded-tile md:motion-safe:data-[state=open]:zoom-in-95"
        >
          <Dialog.Close
            className="gf-icon-btn absolute top-2 right-2 z-(--z-raised) bg-paper-2"
            aria-label={words.close}
          >
            <X className="size-5" aria-hidden="true" strokeWidth={1.75} />
          </Dialog.Close>
          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto overscroll-contain px-5 pt-14 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:grid-cols-2 md:gap-8 md:p-8">
            {shown.status === "loading" || view ? (
              <QuickViewGallery
                images={view?.images ?? []}
                shown={picture}
                show={setPicture}
                words={words}
              />
            ) : null}
            <div className="flex min-w-0 flex-col gap-4 md:pr-8">
              {view?.brand && <p className="text-xs text-text-3">{view.brand}</p>}
              <Dialog.Title className="max-w-none text-title">
                {view?.title ?? ask.title}
              </Dialog.Title>
              {view?.rating && <CardRating rating={view.rating} />}
              {shown.status === "loading" && <Skeleton words={words} />}
              {(shown.status === "error" || shown.status === "missing") && (
                <p role="status" className="text-sm text-text-2">
                  {shown.status === "missing" ? words.missing : words.failed}
                </p>
              )}
              {view && (
                <>
                  {view.summaryHtml ? (
                    <Summary html={view.summaryHtml} />
                  ) : (
                    view.summaryText && (
                      <p className="max-w-[60ch] text-md leading-[1.7] text-text-2">
                        {view.summaryText}
                      </p>
                    )
                  )}
                  <QuickViewBuy
                    view={view}
                    addToCart={setup.addToCart}
                    words={words}
                    onChoose={(variantId) => {
                      setPicture((current) => pictureOf(view, variantId, current))
                    }}
                    onAdded={onAdded}
                  />
                </>
              )}
              {!view?.needsPage && (
                <a href={view?.path ?? ask.path} className="gf-link self-start">
                  {words.openPage}
                </a>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
