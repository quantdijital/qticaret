"use client"

import { X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useRef, useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { PlaceOrderResult, PopupMode, PopupView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { LayerPortal } from "./Layers"
import { CampaignCode, PopupLink, PopupNewsletter } from "./PopupParts"
import type { PopupWords } from "./popup-words"

/** Each way of drawing it: where it stands, how wide, how it comes in (only without reduced motion). */
const MODE_CLASS: Record<PopupMode, string> = {
  // A wide screen's dialog in the middle, the page behind the scrim
  modal:
    "inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-120 rounded-tile motion-safe:data-[state=open]:zoom-in-95",
  // A card in the corner the page's floating buttons leave free; the page stays in use
  corner:
    "bottom-6 left-6 max-h-[calc(100dvh-3rem)] w-[calc(100%-3rem)] max-w-96 rounded-tile motion-safe:data-[state=open]:slide-in-from-bottom-4",
  // A phone's sheet from the bottom, two fifths of the screen at most: never a full-screen interstitial
  sheet:
    "inset-x-0 bottom-0 max-h-[40dvh] rounded-t-tile motion-safe:data-[state=closed]:slide-out-to-bottom motion-safe:data-[state=open]:slide-in-from-bottom",
}

/** The picture's widths: the dialog's 480 px, the card's 384 px. */
const IMAGE_SIZES = "(min-width: 768px) 480px, 100vw"

/** The element the focus was on when it appeared (the page's body is none). */
const focused = () =>
  document.activeElement instanceof HTMLElement && document.activeElement !== document.body
    ? document.activeElement
    : null

/**
 * A shop's pop-up (adr/0080 §6): `modal` a dialog in the middle with a
 * scrim (the focus held inside, the page's scroll locked); `corner` a
 * card at the foot of the screen that takes neither the focus nor the
 * page; `sheet` (every phone) the same card across the bottom, two fifths
 * of the screen at most, without its picture. Each is a labelled dialog
 * (`aria-modal` only for `modal`) on the theme's paper, radius and float
 * shadow; Escape and the 44 px button close it, the scrim too in the
 * middle; the focus goes back where it was. Its body is plain text, its
 * lines kept. A campaign shows its code to copy (or that the cart applies
 * it), an info pop-up its button, a newsletter pop-up the footer's form.
 */
export default function PopupDialog({
  popup,
  mode,
  open,
  onClose,
  onAct,
  words,
  privacyPath,
  subscribe,
}: {
  popup: PopupView
  mode: PopupMode
  open: boolean
  onClose: () => void
  onAct: (action: "click" | "signup") => void
  words: PopupWords
  privacyPath: string | null
  subscribe?: ((state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>) | undefined
}) {
  const [opener] = useState(focused)
  const content = useRef<HTMLDivElement>(null)
  const modal = mode === "modal"
  const stayOpen = (event: Event) => {
    // A card beside the page: a click or the focus elsewhere is the page's, not a close
    if (!modal) {
      event.preventDefault()
    }
  }
  return (
    <Dialog.Root
      open={open}
      modal={modal}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
    >
      <LayerPortal>
        {modal && (
          <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-scrim duration-(--dur-short) motion-safe:data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        )}
        <Dialog.Content
          ref={content}
          data-popup={mode}
          aria-modal={modal || undefined}
          {...(popup.body ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={(event) => {
            // Only the dialog in the middle takes the focus; a card never pulls it off the page
            if (!modal) {
              event.preventDefault()
            }
          }}
          onInteractOutside={stayOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const inside =
              modal ||
              document.activeElement === document.body ||
              (content.current?.contains(document.activeElement) ?? false)
            if (inside && opener?.isConnected) {
              opener.focus()
            }
          }}
          className={cn(
            "fixed z-(--z-modal) flex flex-col bg-paper text-text shadow-float outline-none duration-(--dur-short) motion-safe:data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in data-[state=open]:fade-in-0",
            MODE_CLASS[mode]
          )}
        >
          <Dialog.Close
            className="gf-icon-btn absolute top-2 right-2 z-(--z-raised) bg-paper-2"
            aria-label={words.close}
          >
            <X className="size-5" aria-hidden="true" strokeWidth={1.75} />
          </Dialog.Close>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {popup.image && mode !== "sheet" && (
              <ResponsiveImage
                image={popup.image}
                sizes={IMAGE_SIZES}
                className={cn(
                  "h-auto w-full object-cover",
                  modal ? "max-h-72 rounded-t-tile" : "max-h-44 rounded-t-tile"
                )}
              />
            )}
            <div className="flex flex-col gap-3 px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6">
              <Dialog.Title className="max-w-none pr-10 text-title">{popup.title}</Dialog.Title>
              {popup.body && (
                <Dialog.Description className="text-sm whitespace-pre-line text-text-2">
                  {popup.body}
                </Dialog.Description>
              )}
              {popup.type === "campaign" && popup.promotion && (
                <CampaignCode
                  promotion={popup.promotion}
                  words={words}
                  onCopy={() => {
                    onAct("click")
                  }}
                />
              )}
              {popup.type !== "newsletter" && popup.button && (
                <PopupLink
                  button={popup.button}
                  onFollow={() => {
                    onAct("click")
                  }}
                />
              )}
              {popup.type === "newsletter" && subscribe && (
                <PopupNewsletter
                  popup={popup}
                  words={words}
                  privacyPath={privacyPath}
                  subscribe={subscribe}
                  onSignup={() => {
                    onAct("signup")
                  }}
                />
              )}
            </div>
          </div>
        </Dialog.Content>
      </LayerPortal>
    </Dialog.Root>
  )
}
