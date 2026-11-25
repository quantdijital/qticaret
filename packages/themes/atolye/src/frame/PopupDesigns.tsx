"use client"

import { Dialog } from "radix-ui"
import type { ReactNode } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { PopupDesign, PopupMode, PopupView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** The picture's widths: the dialog's 480 px (720 px split, half of it the picture), the card's 384 px. */
const IMAGE_SIZES = "(min-width: 768px) 480px, 100vw"
const SPLIT_SIZES = "(min-width: 640px) 360px, 100vw"

/** The words' block: the classic padding, the phone's sheet over the safe area. */
const WORDS = "flex flex-col gap-3 px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6"

/** Whether a design draws its picture beside the words: a wide screen's dialog with one only. */
export const splitsWide = (popup: PopupView, mode: PopupMode) =>
  popup.design === "split" && mode === "modal" && popup.image !== null

/** The designs that centre their words (the form keeps its own left edge). */
const CENTRED: ReadonlySet<PopupDesign> = new Set(["hero", "minimal", "coupon"])

/**
 * The inside of a pop-up (adr/0080 §6a), one design whatever its type and
 * place: `classic` the picture above the words (the first design, kept as
 * it was); `split` the picture beside the words in a wide screen's dialog
 * (above them elsewhere); `hero` a tall picture, the words centred; `minimal`
 * the words alone, centred, the title large, no picture; `coupon` centred,
 * the code a ticket (`actions` draws it), the title one when there is no
 * code. A phone's sheet never draws the picture. `actions` are the code,
 * the button or the form, the same in every design.
 */
export function PopupBody({
  popup,
  mode,
  actions,
}: {
  popup: PopupView
  mode: PopupMode
  actions: ReactNode
}) {
  const modal = mode === "modal"
  const design = popup.design
  const picture = popup.image && mode !== "sheet" && design !== "minimal" ? popup.image : null
  const centred = CENTRED.has(design)
  const ticketTitle = design === "coupon" && !(popup.type === "campaign" && popup.promotion)
  const large = design === "minimal" || design === "hero" || ticketTitle
  const title = (
    <Dialog.Title
      className={cn(
        "max-w-none",
        large ? "text-section" : "text-title",
        centred ? "px-10 text-center" : "pr-10",
        ticketTitle && "rounded-inner border-2 border-dashed border-edge py-5"
      )}
    >
      {popup.title}
    </Dialog.Title>
  )
  const body = popup.body ? (
    <Dialog.Description
      className={cn("text-sm whitespace-pre-line text-text-2", centred && "text-center")}
    >
      {popup.body}
    </Dialog.Description>
  ) : null
  if (design === "classic") {
    return (
      <>
        {picture && (
          <ResponsiveImage
            image={picture}
            sizes={IMAGE_SIZES}
            className={cn(
              "h-auto w-full object-cover",
              modal ? "max-h-72 rounded-t-tile" : "max-h-44 rounded-t-tile"
            )}
          />
        )}
        <div className={WORDS}>
          {title}
          {body}
          {actions}
        </div>
      </>
    )
  }
  if (splitsWide(popup, mode) && picture) {
    return (
      <div className="flex flex-col sm:grid sm:grid-cols-2">
        <ResponsiveImage
          image={picture}
          sizes={SPLIT_SIZES}
          className="h-auto max-h-56 w-full rounded-t-tile object-cover sm:h-full sm:max-h-none sm:min-h-80 sm:rounded-tr-none sm:rounded-bl-tile"
        />
        <div className={cn(WORDS, "sm:justify-center sm:p-8")}>
          {title}
          {body}
          {actions}
        </div>
      </div>
    )
  }
  return (
    <>
      {picture && (
        <ResponsiveImage
          image={picture}
          sizes={IMAGE_SIZES}
          className={cn(
            "h-auto w-full rounded-t-tile object-cover",
            design === "hero" ? (modal ? "aspect-[4/3] max-h-96" : "aspect-video max-h-52") : "",
            design === "coupon" && "max-h-40",
            design === "split" && (modal ? "max-h-72" : "max-h-44")
          )}
        />
      )}
      <div
        data-popup-words={centred ? "centred" : undefined}
        className={cn(
          WORDS,
          centred && "[&>a.gf-btn]:self-center",
          design === "minimal" && "gap-4 pt-10 sm:px-10 sm:pt-12 sm:pb-10",
          design === "hero" && !picture && "pt-10 sm:pt-10"
        )}
      >
        {title}
        {body}
        {actions}
      </div>
    </>
  )
}
