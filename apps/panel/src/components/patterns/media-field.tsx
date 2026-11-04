import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { MediaPicker } from "@/components/patterns/media-picker"
import { Button } from "@/components/ui/button"
import type { MediaAsset } from "@/features/media/api/media"
import { cn } from "@/lib/utils"

/** The picture's frame: a slide or opening, a share card, a square, a logo on its ground. */
export type MediaFrame = "wide" | "share" | "square" | "logo"

const FRAME: Record<MediaFrame, string> = {
  wide: "aspect-[16/9] w-full",
  share: "aspect-[1.91/1] w-full",
  square: "aspect-square w-28 shrink-0",
  logo: "h-24 w-full p-3",
}

interface MediaFieldProps {
  id: string
  label: string
  hint?: string | undefined
  /** The picture's address, or null for none. */
  value: string | null
  /** The chosen image from the library, or null when taken off. */
  onChange: (asset: MediaAsset | null) => void
  frame?: MediaFrame
  /** The frame's ground (a logo on the light or the dark one). */
  ground?: string
  /** Said in the empty frame. */
  emptyText?: string
  /** A picture the place needs (a slide's) is replaced, never taken off. */
  removable?: boolean
  /** A save in flight elsewhere: the buttons wait for it. */
  busy?: boolean
  /** Side by side from `sm` up: the picture left, its words and buttons right. */
  inline?: boolean
  /** The card's own title already names it: the label is read out, not shown. */
  hideLabel?: boolean
  pickerTitle?: string
  /** What goes with the picture (its alt text), beside it while there is one. */
  children?: ReactNode
}

/**
 * One picture of a form (docs/18 §7): what it looks like, and choosing it
 * from the media library, this computer or an address through
 * `MediaPicker`, replacing or taking it off. Its alt text stays beside it.
 */
export function MediaField({
  id,
  label,
  hint,
  value,
  onChange,
  frame = "wide",
  ground,
  emptyText,
  removable = true,
  busy = false,
  inline = false,
  hideLabel = false,
  pickerTitle,
  children,
}: MediaFieldProps) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  const title = (
    <span id={`${id}-label`} className={hideLabel ? "sr-only" : "text-sm font-medium"}>
      {label}
    </span>
  )
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className={cn("flex min-w-0 flex-col gap-2", inline && "sm:flex-row sm:items-start sm:gap-4")}
    >
      {inline ? null : title}
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-md border",
          FRAME[frame],
          inline && frame !== "square" && "sm:w-72 sm:shrink-0",
          value ? (ground ?? "bg-muted") : (ground ?? "border-dashed")
        )}
      >
        {value ? (
          <img
            src={value}
            alt={label}
            className={cn(
              frame === "logo" || frame === "square"
                ? "max-h-full max-w-full object-contain"
                : "size-full object-cover"
            )}
          />
        ) : (
          // On a ground of its own (a logo's dark one) the ground's text colour reads, not the card's
          <span className={cn("px-4 text-center text-[13px]", !ground && "text-muted-foreground")}>
            {emptyText ?? t("media.field.empty")}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {inline ? title : null}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            aria-label={t(value ? "media.field.replaceOf" : "media.field.chooseOf", { label })}
            onClick={() => {
              setPicking(true)
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {t(value ? "media.field.replace" : "media.field.choose")}
          </Button>
          {value && removable ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              className="text-destructive-text"
              aria-label={t("media.field.removeOf", { label })}
              onClick={() => {
                onChange(null)
              }}
            >
              <Trash2 />
              {t("media.field.remove")}
            </Button>
          ) : null}
        </div>
        {value ? children : null}
      </div>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        title={pickerTitle ?? label}
        onSelect={([asset]) => {
          if (asset) {
            onChange(asset)
          }
        }}
      />
    </div>
  )
}
