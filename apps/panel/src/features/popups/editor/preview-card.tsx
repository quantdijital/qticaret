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
import { PageStandIn } from "./preview-page"
import { MARGINS, boxWidth, previewScreen, useScaledScreen } from "./preview-scale"
import type { Device } from "./preview-scale"

const V = "popups.preview"

/**
 * The pop-up at its storefront size on the page around it (on a laptop
 * the part of the page beside the window or the corner card, on a phone
 * its whole 390 px screen), scaled down as one to the card's width. A
 * pop-up taller than that makes it taller (the storefront scrolls it
 * inside) rather than cut it.
 */
export function PageFrame({
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
  const picture = content.imageUrl !== ""
  const viewport = previewScreen(device, layout, content.design, picture)
  const { room, screen, scale, height } = useScaledScreen(viewport)
  return (
    <div className={cn("mx-auto w-full rounded-md border", phone && "max-w-64")}>
      <div
        ref={room}
        data-preview-room={device}
        // The screen is laid out wider than the room before it is scaled; only that is clipped
        className="relative overflow-clip rounded-md"
        style={{ height }}
      >
        <div
          ref={screen}
          data-preview-screen={device}
          className="absolute top-0 left-0 flex origin-top-left flex-col bg-background"
          style={{
            width: viewport.width,
            minHeight: viewport.height,
            transform: `scale(${String(scale)})`,
          }}
        >
          <PageStandIn view={phone ? "phone" : layout === "corner" ? "corner" : "window"} />
          {modal ? <div aria-hidden="true" className="absolute inset-0 bg-foreground/25" /> : null}
          <div
            className={cn(
              "relative flex flex-1",
              phone ? "items-end" : modal ? "items-center justify-center" : "items-end"
            )}
            style={phone ? undefined : { padding: MARGINS[layout] }}
          >
            <PopupBox
              content={content}
              place={phone ? "sheet" : modal ? "modal" : "corner"}
              width={phone ? null : boxWidth(layout, content.design, picture)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * How it reads on the storefront, as it is typed (adr/0080 §6): its
 * design (§6a) in a centred window or a corner card on a laptop's screen,
 * a bottom sheet on a phone's, each screen scaled down whole.
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
