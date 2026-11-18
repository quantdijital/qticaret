import { ArrowLeft, ArrowRight, Star, Trash2, Wand2 } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@qticaret/admin-ui/ui/popover"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { useBackgroundTask } from "@/features/ai/use-ai-background"
import { AiEditedBadge } from "@/features/ai/components/ai-edited-badge"
import { AltField } from "./gallery-alt-field"
import { TileBackground } from "./tile-background"

export interface GalleryImage {
  key: string
  url: string
  /** The picture's alt text where the page keeps one (the product page). */
  alt?: {
    value: string
    /** An old picture added by address: no record to keep an alt text in. */
    legacy: boolean
    /** Its WebP/AVIF versions and share crop: made, being made, or none (no file). */
    versions: "ready" | "pending" | null
    /** Its media record when its file is stored: the AI can read it for an alt text suggestion. */
    mediaId?: string | null
  }
  /** Made by an AI service from one of the shop's pictures: a small mark on the tile. */
  aiEdited?: boolean
}

interface TileDrag {
  start: () => void
  over: () => void
  end: () => void
  drop: () => void
}

interface GalleryTileProps {
  image: GalleryImage
  index: number
  count: number
  disabled: boolean
  withAlt: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  dragging: boolean
  /** Another tile is dragged over this one: it lands here. */
  target: boolean
  drag: TileDrag
  onMakeMain: () => void
  onMove: (to: number) => void
  onRemove: () => void
  onAlt: (alt: string) => void
  /** Adds a picture to the product (the AI background's result); left out: no such action. */
  onAddImage?: ((stored: { id: string; url: string }) => void) | undefined
  /** The product's picture limit, and whether it is reached. */
  room?: { full: boolean; max: number }
}

/**
 * One picture of the gallery: dragged into its place, the first marked as
 * the main one, a note when it has no alt text. A click opens its alt
 * text, its versions' state and its actions (main, move, remove); the
 * move buttons do what dragging does (WCAG 2.5.7).
 */
export function GalleryTile({
  image,
  index,
  count,
  disabled,
  withAlt,
  open,
  onOpenChange,
  dragging,
  target,
  drag,
  onMakeMain,
  onMove,
  onRemove,
  onAlt,
  onAddImage,
  room = { full: false, max: 0 },
}: GalleryTileProps) {
  const { t } = useTranslation()
  const position = index + 1
  const [cleaning, setCleaning] = useState(false)
  const mediaId = image.alt?.legacy ? null : (image.alt?.mediaId ?? null)
  const background = useBackgroundTask(Boolean(onAddImage && mediaId))
  const canClean = Boolean(onAddImage && mediaId && background.allowed)
  // An old picture added by address has none either; its popover says how to give it one
  const noAlt = withAlt && !image.alt?.value.trim()
  const action = (label: string, icon: ReactNode, run: () => void, off = false) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="justify-start"
      disabled={disabled || off}
      onClick={run}
    >
      {icon}
      {label}
    </Button>
  )
  return (
    <li
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        // Firefox starts a drag only with data
        event.dataTransfer.setData("text/plain", image.url)
        drag.start()
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) {
          event.preventDefault()
          drag.over()
        }
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) {
          event.preventDefault()
          drag.drop()
        }
      }}
      onDragEnd={drag.end}
      className={cn(
        "relative min-w-0 rounded-lg transition-opacity",
        dragging && "opacity-40",
        target && "outline-2 outline-offset-2 outline-primary outline-dashed"
      )}
    >
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={[
              t("products.media.position", { position }),
              index === 0 ? `, ${t("products.media.main")}` : "",
              withAlt
                ? `: ${noAlt ? t("products.media.noAlt") : (image.alt?.value.trim() ?? "")}`
                : "",
            ].join("")}
            className={cn(
              "group relative block aspect-square w-full cursor-grab overflow-hidden rounded-lg border bg-muted outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring active:cursor-grabbing",
              index === 0 && "ring-2 ring-primary ring-offset-2 ring-offset-card"
            )}
          >
            <img
              src={image.url}
              alt=""
              draggable={false}
              className="size-full object-cover transition-transform group-hover:scale-[1.02]"
            />
            {index === 0 ? (
              <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                {t("products.media.main")}
              </span>
            ) : null}
            {image.aiEdited ? (
              <AiEditedBadge look="icon" className="absolute top-1.5 right-1.5" />
            ) : null}
            {noAlt ? (
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-text">
                {t("products.media.noAlt")}
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-80 flex-col gap-3">
          {withAlt ? <AltField image={image} position={position} onAlt={onAlt} /> : null}
          {image.alt?.versions ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{t("products.media.versions")}</span>
              <StatusBadge tone={image.alt.versions === "ready" ? "success" : "neutral"}>
                {t(
                  image.alt.versions === "ready"
                    ? "products.media.versionsReady"
                    : "products.media.versionsPending"
                )}
              </StatusBadge>
            </div>
          ) : null}
          <div className={cn("flex flex-col", withAlt && "border-t pt-2")}>
            {index > 0
              ? action(t("products.media.makeMain"), <Star />, () => {
                  onMakeMain()
                  onOpenChange(false)
                })
              : null}
            {canClean
              ? action(t("ai.background.button"), <Wand2 />, () => {
                  onOpenChange(false)
                  setCleaning(true)
                })
              : null}
            {action(
              t("products.media.moveEarlier"),
              <ArrowLeft />,
              () => {
                onMove(index - 1)
              },
              index === 0
            )}
            {action(
              t("products.media.moveLater"),
              <ArrowRight />,
              () => {
                onMove(index + 1)
              },
              index === count - 1
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start text-destructive-text"
              disabled={disabled}
              onClick={onRemove}
            >
              <Trash2 />
              {t("products.media.remove")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {cleaning && mediaId && onAddImage ? (
        <TileBackground
          source={{ id: mediaId, url: image.url }}
          full={room.full}
          max={room.max}
          onAdd={onAddImage}
          onClose={() => {
            setCleaning(false)
          }}
        />
      ) : null}
    </li>
  )
}
