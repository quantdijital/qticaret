import { Copy, X } from "lucide-react"
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

/** The code, the form or the button: the same parts in every design. */
function Actions({ content, centred }: { content: PreviewContent; centred: boolean }) {
  const { t } = useTranslation()
  const button = content.buttonLabel.trim()
  const ticket = content.design === "coupon"
  return (
    <>
      {content.type === "campaign" ? (
        ticket ? (
          <span
            data-preview-ticket=""
            className="mt-1 flex flex-col items-center gap-1 rounded-sm border-2 border-dashed bg-muted/60 px-2 py-2 text-center"
          >
            <span className="text-sm font-bold tracking-widest break-all">
              {content.code ?? t(`${V}.automatic`)}
            </span>
            {content.code ? (
              <span className="h-6 rounded-sm bg-primary px-3 text-[11px] leading-6 font-medium text-primary-foreground">
                {t(`${V}.copy`)}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="mt-1 inline-flex items-center justify-between gap-2 rounded-sm border border-dashed px-2 py-1 text-xs font-semibold tracking-wide">
            {content.code ?? t(`${V}.automatic`)}
            {content.code ? <Copy aria-hidden="true" className="size-3" /> : null}
          </span>
        )
      ) : null}
      {content.type === "newsletter" ? (
        <div className="mt-1 flex flex-col gap-1.5">
          <span className="h-7 rounded-sm border px-2 text-left text-xs leading-7 text-muted-foreground">
            {t(`${V}.email`)}
          </span>
          <span className="h-7 rounded-sm bg-primary text-center text-xs leading-7 font-medium text-primary-foreground">
            {button || t(`${V}.subscribe`)}
          </span>
        </div>
      ) : button ? (
        <span
          className={cn(
            "mt-1 h-7 rounded-sm bg-primary px-3 text-xs leading-7 font-medium text-primary-foreground",
            centred ? "self-center" : "self-start"
          )}
        >
          {button}
        </span>
      ) : null}
    </>
  )
}

/**
 * The pop-up itself, drawn plainly in its design (adr/0080 §6a): the
 * theme draws the real one in its own style. Like the storefront, a
 * phone's sheet has no picture, `minimal` never one, and `split` puts it
 * beside the words only in the wide window.
 */
export function PopupBox({
  content,
  place = "modal",
  className,
}: {
  content: PreviewContent
  place?: PreviewPlace
  className?: string
}) {
  const { t } = useTranslation()
  const { design } = content
  const centred = CENTRED.has(design)
  const picture =
    content.imageUrl && place !== "sheet" && design !== "minimal" ? content.imageUrl : ""
  const split = design === "split" && place === "modal" && picture !== ""
  const ticketTitle = design === "coupon" && content.type !== "campaign"
  const large = design === "hero" || design === "minimal" || ticketTitle
  return (
    <div
      data-preview-design={design}
      className={cn(
        "relative flex overflow-hidden rounded-md border bg-background text-foreground shadow-overlay",
        split ? "flex-row" : "flex-col",
        className
      )}
    >
      <X aria-hidden="true" className="absolute top-2 right-2 size-3.5 text-muted-foreground" />
      {picture ? (
        <img
          src={picture}
          alt={content.imageAlt}
          className={cn(
            "w-full object-cover",
            split ? "w-2/5 self-stretch" : design === "hero" ? "aspect-[4/3]" : "aspect-[16/9]",
            design === "coupon" && "aspect-[3/1]"
          )}
        />
      ) : null}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-1.5 p-3",
          centred ? "px-6 text-center" : "pr-6",
          split && "justify-center",
          design === "minimal" && "gap-2 py-5"
        )}
      >
        <p
          className={cn(
            "font-semibold break-words",
            large ? "text-base leading-6" : "text-sm leading-5",
            ticketTitle && "rounded-sm border-2 border-dashed px-2 py-2"
          )}
        >
          {content.title.trim() || t(`${V}.titlePlaceholder`)}
        </p>
        {content.body.trim() ? (
          <p className="line-clamp-4 text-xs leading-4 break-words whitespace-pre-line text-muted-foreground">
            {content.body.trim()}
          </p>
        ) : null}
        <Actions content={content} centred={centred} />
      </div>
    </div>
  )
}
