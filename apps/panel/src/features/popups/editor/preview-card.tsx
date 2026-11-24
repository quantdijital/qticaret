import { useQuery } from "@tanstack/react-query"
import { Copy, Monitor, Smartphone, X } from "lucide-react"
import { useState } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { promotionsQuery } from "@/features/promotions/api/promotions"
import type { PopupLayout, PopupType } from "@/features/popups/api/types"
import type { PopupValues } from "@/features/popups/form"

const V = "popups.preview"

type Device = "desktop" | "mobile"

export interface PreviewContent {
  type: PopupType
  title: string
  body: string
  imageUrl: string
  imageAlt: string
  buttonLabel: string
  /** A campaign's code as the storefront shows it; null for one that applies on its own. */
  code: string | null
}

/** The pop-up itself, drawn plainly: the theme (S3) draws the real one in its own style. */
export function PopupBox({ content, className }: { content: PreviewContent; className?: string }) {
  const { t } = useTranslation()
  const button = content.buttonLabel.trim()
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-md border bg-background text-foreground shadow-overlay",
        className
      )}
    >
      <X aria-hidden="true" className="absolute top-2 right-2 size-3.5 text-muted-foreground" />
      {content.imageUrl ? (
        <img
          src={content.imageUrl}
          alt={content.imageAlt}
          className="aspect-[16/9] w-full object-cover"
        />
      ) : null}
      <div className="flex flex-col gap-1.5 p-3 pr-6">
        <p className="text-sm leading-5 font-semibold break-words">
          {content.title.trim() || t(`${V}.titlePlaceholder`)}
        </p>
        {content.body.trim() ? (
          <p className="line-clamp-4 text-xs leading-4 break-words whitespace-pre-line text-muted-foreground">
            {content.body.trim()}
          </p>
        ) : null}
        {content.type === "campaign" ? (
          <span className="mt-1 inline-flex items-center justify-between gap-2 rounded-sm border border-dashed px-2 py-1 text-xs font-semibold tracking-wide">
            {content.code ?? t(`${V}.automatic`)}
            {content.code ? <Copy aria-hidden="true" className="size-3" /> : null}
          </span>
        ) : null}
        {content.type === "newsletter" ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <span className="h-7 rounded-sm border px-2 text-xs leading-7 text-muted-foreground">
              {t(`${V}.email`)}
            </span>
            <span className="h-7 rounded-sm bg-primary text-center text-xs leading-7 font-medium text-primary-foreground">
              {button || t(`${V}.subscribe`)}
            </span>
          </div>
        ) : button ? (
          <span className="mt-1 h-7 self-start rounded-sm bg-primary px-3 text-xs leading-7 font-medium text-primary-foreground">
            {button}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** A page's stand-in: a few grey lines, dimmed under a window. */
function PageFrame({
  device,
  layout,
  content,
}: {
  device: Device
  layout: PopupLayout
  content: PreviewContent
}) {
  const phone = device === "mobile"
  const modal = layout === "modal" && !phone
  return (
    <div
      className={cn(
        "relative mx-auto w-full overflow-hidden rounded-md border bg-muted/50",
        phone ? "aspect-[9/16] max-w-56" : "aspect-[4/3]"
      )}
    >
      <div aria-hidden="true" className="flex flex-col gap-2 p-3">
        <span className="h-3 w-1/3 rounded-sm bg-muted" />
        <span className="h-16 w-full rounded-sm bg-muted" />
        <span className="h-2 w-5/6 rounded-sm bg-muted" />
        <span className="h-2 w-2/3 rounded-sm bg-muted" />
      </div>
      {modal ? <div aria-hidden="true" className="absolute inset-0 bg-foreground/25" /> : null}
      <div
        className={cn(
          "absolute flex",
          phone
            ? "inset-x-0 bottom-0 max-h-[60%] [&>*]:w-full [&>*]:rounded-b-none"
            : modal
              ? "inset-0 items-center justify-center p-4 [&>*]:max-h-full [&>*]:w-3/5"
              : "right-2 bottom-2 w-1/2"
        )}
      >
        <PopupBox content={content} className="w-full" />
      </div>
    </div>
  )
}

/**
 * How it reads on the storefront, as it is typed (adr/0080 §6): a centred
 * window or a corner card on a wide screen, a bottom sheet on a phone.
 */
export function PreviewCard() {
  const { t } = useTranslation()
  const { control } = useFormContext<PopupValues>()
  const [device, setDevice] = useState<Device>("desktop")
  const [type, title, body, imageUrl, imageAlt, buttonLabel, promotionId, layout] = useWatch({
    control,
    name: [
      "type",
      "title",
      "body",
      "image_url",
      "image_alt",
      "button_label",
      "promotion_id",
      "layout",
    ],
  })
  const promotions = useQuery({ ...promotionsQuery(), enabled: type === "campaign" })
  const promotion = promotions.data?.promotions.find((each) => each.id === promotionId)
  // An automatic promotion has no code: the storefront says it applies in the cart
  const code = promotion ? (promotion.code ?? null) : t(`${V}.codePlaceholder`)
  const content: PreviewContent = {
    type,
    title,
    body,
    imageUrl,
    imageAlt,
    buttonLabel,
    code,
  }
  return (
    <SectionCard
      title={t(`${V}.title`)}
      action={
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label={t(`${V}.device`)}
          value={device}
          onValueChange={(next) => {
            if (next) {
              setDevice(next as Device)
            }
          }}
        >
          <ToggleGroupItem value="desktop" aria-label={t(`${V}.desktop`)} title={t(`${V}.desktop`)}>
            <Monitor />
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" aria-label={t(`${V}.mobile`)} title={t(`${V}.mobile`)}>
            <Smartphone />
          </ToggleGroupItem>
        </ToggleGroup>
      }
    >
      <PageFrame device={device} layout={layout} content={content} />
    </SectionCard>
  )
}
