import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { PopupDesign, PopupType } from "@/features/popups/api/types"

const V = "popups.preview"

export interface PreviewContent {
  type: PopupType
  design: PopupDesign
  title: string
  body: string
  imageUrl: string
  imageAlt: string
  buttonLabel: string
  /** A campaign's code as the storefront shows it; null for one that applies on its own. */
  code: string | null
}

/** Where it is drawn: the picture's place depends on it (a phone's sheet has none). */
export type PreviewPlace = "modal" | "corner" | "sheet"

const CENTRED: ReadonlySet<PopupDesign> = new Set(["hero", "minimal", "coupon"])

/** A storefront button at its own size (44 px tall). */
const BUTTON = "inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"

/** The code, the form or the button: the same parts in every design. */
function Actions({
  content,
  centred,
  sheet,
}: {
  content: PreviewContent
  centred: boolean
  /** A phone's sheet: its button spans the sheet, as on the storefront. */
  sheet: boolean
}) {
  const { t } = useTranslation()
  const button = content.buttonLabel.trim()
  const ticket = content.design === "coupon"
  return (
    <>
      {content.type === "campaign" ? (
        content.code === null ? (
          <p className={cn("text-sm font-semibold", ticket && "text-center")}>
            {t(`${V}.automatic`)}
          </p>
        ) : ticket ? (
          <span
            data-preview-ticket=""
            className="flex flex-col items-center gap-3 rounded-md border-2 border-dashed bg-muted px-6 py-5 text-center"
          >
            <span className="font-mono text-2xl font-bold tracking-widest break-all">
              {content.code}
            </span>
            <span className={cn(BUTTON, "bg-primary text-primary-foreground")}>
              {t(`${V}.copy`)}
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-2 rounded-md bg-muted p-1.5 pl-4">
            <span className="min-w-0 flex-1 truncate font-mono text-base font-bold tracking-wider">
              {content.code}
            </span>
            <span className={cn(BUTTON, "h-9 bg-primary px-4 text-primary-foreground")}>
              {t(`${V}.copy`)}
            </span>
          </span>
        )
      ) : null}
      {content.type === "newsletter" ? (
        <div className="flex flex-col gap-2">
          <span className="h-11 rounded-md border px-3 text-left text-sm leading-[2.625rem] text-muted-foreground">
            {t(`${V}.email`)}
          </span>
          <span className={cn(BUTTON, "bg-primary text-primary-foreground")}>
            {button || t(`${V}.subscribe`)}
          </span>
        </div>
      ) : button ? (
        <span
          className={cn(
            BUTTON,
            "bg-primary text-primary-foreground",
            sheet ? "self-stretch" : centred ? "self-center" : "self-start"
          )}
        >
          {button}
        </span>
      ) : null}
    </>
  )
}

/** The picture's height on the storefront for each design and place (Atölye's `PopupBody`). */
function pictureClass(design: PopupDesign, modal: boolean): string {
  if (design === "hero") {
    return modal ? "aspect-[4/3] max-h-96" : "aspect-video max-h-52"
  }
  if (design === "coupon") {
    return "max-h-40"
  }
  return modal ? "max-h-72" : "max-h-44"
}

/**
 * The pop-up itself, drawn plainly in its design (adr/0080 §6a) at its
 * storefront size (the theme draws the real one in its own style): the
 * preview scales the whole screen down, so it is never shrunk or cut
 * here. Like the storefront, a phone's sheet has no picture, `minimal`
 * never one, and `split` puts it beside the words only in the wide window.
 */
export function PopupBox({
  content,
  place = "modal",
  width = null,
  className,
}: {
  content: PreviewContent
  place?: PreviewPlace
  /** Its width in px on a laptop's screen; null spans the screen (a phone's sheet). */
  width?: number | null
  className?: string
}) {
  const { t } = useTranslation()
  const { design } = content
  const modal = place === "modal"
  const sheet = place === "sheet"
  const centred = CENTRED.has(design)
  const picture = content.imageUrl && !sheet && design !== "minimal" ? content.imageUrl : ""
  const split = design === "split" && modal && picture !== ""
  // A campaign's code is the ticket; without one the title takes its place
  const ticketTitle = design === "coupon" && content.type !== "campaign"
  const large = design === "hero" || design === "minimal" || ticketTitle
  return (
    <div
      data-preview-design={design}
      data-preview-place={place}
      className={cn(
        "relative flex shrink-0 flex-col bg-background text-foreground shadow-overlay",
        sheet ? "w-full rounded-t-xl border-t" : "rounded-xl border",
        className
      )}
      style={width === null ? undefined : { width }}
    >
      <span
        aria-hidden="true"
        className="absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-full bg-muted"
      >
        <X className="size-5 text-muted-foreground" />
      </span>
      <div className={split ? "grid grid-cols-2" : "flex flex-col"}>
        {picture ? (
          <img
            src={picture}
            alt={content.imageAlt}
            className={cn(
              "w-full object-cover",
              split
                ? "h-full min-h-80 rounded-l-xl"
                : cn("h-auto rounded-t-xl", pictureClass(design, modal))
            )}
          />
        ) : null}
        <div
          className={cn(
            "flex min-w-0 flex-col gap-3",
            sheet ? "px-5 py-5" : "p-6",
            split && "justify-center p-8",
            design === "minimal" && (sheet ? "gap-4 pt-10" : "gap-4 px-10 pt-12 pb-10"),
            design === "hero" && !picture && "pt-10"
          )}
        >
          <p
            className={cn(
              "leading-snug font-semibold break-words",
              large ? (sheet ? "text-xl" : "text-2xl") : sheet ? "text-[17px]" : "text-lg",
              centred ? "px-10 text-center" : "pr-10",
              ticketTitle && "rounded-md border-2 border-dashed py-5"
            )}
          >
            {content.title.trim() || t(`${V}.titlePlaceholder`)}
          </p>
          {content.body.trim() ? (
            <p
              className={cn(
                "text-sm leading-relaxed break-words whitespace-pre-line text-muted-foreground",
                centred && "text-center"
              )}
            >
              {content.body.trim()}
            </p>
          ) : null}
          <Actions content={content} centred={centred} sheet={sheet} />
        </div>
      </div>
    </div>
  )
}
