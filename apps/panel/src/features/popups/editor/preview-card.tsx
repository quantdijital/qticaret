import { useQuery } from "@tanstack/react-query"
import { Monitor, Smartphone } from "lucide-react"
import { useState } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { promotionsQuery } from "@/features/promotions/api/promotions"
import type { PopupLayout } from "@/features/popups/api/types"
import type { PopupValues } from "@/features/popups/form"
import { PopupBox } from "./preview-box"
import type { PreviewContent } from "./preview-box"

const V = "popups.preview"

type Device = "desktop" | "mobile"

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
              ? cn(
                  "inset-0 items-center justify-center p-4 [&>*]:max-h-full",
                  // The split design's window is wider: its picture stands beside the words
                  content.design === "split" && content.imageUrl ? "[&>*]:w-4/5" : "[&>*]:w-3/5"
                )
              : "right-2 bottom-2 w-1/2"
        )}
      >
        <PopupBox
          content={content}
          place={phone ? "sheet" : modal ? "modal" : "corner"}
          className="w-full"
        />
      </div>
    </div>
  )
}

/**
 * How it reads on the storefront, as it is typed (adr/0080 §6): its
 * design (§6a) in a centred window or a corner card on a wide screen, a
 * bottom sheet on a phone.
 */
export function PreviewCard() {
  const { t } = useTranslation()
  const { control } = useFormContext<PopupValues>()
  const [device, setDevice] = useState<Device>("desktop")
  const [type, title, body, imageUrl, imageAlt, buttonLabel, promotionId, layout, design] =
    useWatch({
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
        "design",
      ],
    })
  const promotions = useQuery({ ...promotionsQuery(), enabled: type === "campaign" })
  const promotion = promotions.data?.promotions.find((each) => each.id === promotionId)
  // An automatic promotion has no code: the storefront says it applies in the cart
  const code = promotion ? (promotion.code ?? null) : t(`${V}.codePlaceholder`)
  const content: PreviewContent = {
    type,
    design,
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
