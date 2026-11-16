import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { useState } from "react"
import type { DragEvent, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { MediaPicker } from "@/components/patterns/media-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import { fileProblem, uploadToLibrary, useMediaChanged } from "@/features/media/api/media"
import type { MediaAsset } from "@/features/media/api/media"
import { errorText } from "@/lib/errors"
import { cn } from "@qticaret/admin-ui/lib/utils"

/**
 * The picture's frame: a slide or opening, a share card, a square, a logo
 * on its ground, or a storefront tile (4:5, cropped as shoppers see it).
 */
export type MediaFrame = "wide" | "share" | "square" | "logo" | "tile"

const FRAME: Record<MediaFrame, string> = {
  wide: "aspect-[16/9] w-full",
  share: "aspect-[1.91/1] w-full",
  square: "aspect-square w-28 shrink-0",
  logo: "h-24 w-full p-3",
  tile: "aspect-[4/5] w-36 shrink-0",
}

/** Frames of a set size: beside their words even when inline, never stretched. */
const FIXED: ReadonlySet<MediaFrame> = new Set(["square", "tile"])

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
  /** An SVG may be chosen: the shop's logos and site icon only (the server refuses it elsewhere). */
  svg?: boolean
  /** What goes with the picture (its alt text), beside it while there is one. */
  children?: ReactNode
  /** Beside the empty frame in place of the hint: what shows without a picture. */
  emptyAside?: ReactNode
}

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files")

/**
 * One picture of a form (docs/18 §7, one way to add a picture): its frame
 * is the way in. A click opens `MediaPicker` (library, upload, address); a
 * file dropped on it goes into the library and is chosen at once. With a
 * picture, the frame replaces it the same way and "Kaldır" takes it off;
 * its alt text stays beside it.
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
  svg = false,
  children,
  emptyAside,
}: MediaFieldProps) {
  const { t } = useTranslation()
  const changed = useMediaChanged()
  const [picking, setPicking] = useState(false)
  const [over, setOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const working = busy || uploading

  const upload = async (file: File | undefined) => {
    if (!file) {
      return
    }
    const problem = fileProblem(file, svg)
    if (problem) {
      toast.error(`${file.name}: ${t(`media.upload.problem.${problem}`)}`)
      return
    }
    setUploading(true)
    try {
      const asset = await uploadToLibrary(file)
      await changed()
      onChange(asset)
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setUploading(false)
    }
  }

  const title = (
    <span id={`${id}-label`} className={hideLabel ? "sr-only" : "text-sm font-medium"}>
      {label}
    </span>
  )
  const small = frame === "square" || frame === "logo"
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className={cn("flex min-w-0 flex-col gap-2", inline && "sm:flex-row sm:items-start sm:gap-4")}
    >
      {inline ? null : title}
      <button
        type="button"
        disabled={working}
        aria-label={t(value ? "media.field.replaceOf" : "media.field.chooseOf", { label })}
        onClick={() => {
          setPicking(true)
        }}
        onDragOver={(event) => {
          if (hasFiles(event)) {
            event.preventDefault()
            setOver(true)
          }
        }}
        onDragLeave={() => {
          setOver(false)
        }}
        onDrop={(event) => {
          if (hasFiles(event)) {
            event.preventDefault()
            setOver(false)
            void upload(event.dataTransfer.files[0])
          }
        }}
        className={cn(
          "group relative flex items-center justify-center overflow-hidden rounded-md border outline-hidden transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-progress",
          FRAME[frame],
          inline && !FIXED.has(frame) && "sm:w-72 sm:shrink-0",
          value ? (ground ?? "bg-muted") : (ground ?? "border-2 border-dashed hover:bg-muted/50"),
          over && "border-primary bg-accent"
        )}
      >
        {value ? (
          <>
            <img
              src={value}
              alt={label}
              className={cn(
                small ? "max-h-full max-w-full object-contain" : "size-full object-cover"
              )}
            />
            <span className="absolute right-1.5 bottom-1.5 rounded-full border bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground">
              {t("media.field.replace")}
            </span>
          </>
        ) : (
          // On a ground of its own (a logo's dark one) the ground's text colour reads, not the card's
          <span
            className={cn(
              "flex flex-col items-center gap-1.5 px-3 text-center text-[13px]",
              !ground && "text-muted-foreground"
            )}
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            <span>{emptyText ?? t("media.field.empty")}</span>
            {small ? null : <span className="text-xs">{t("media.field.dropHint")}</span>}
          </span>
        )}
        {working ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
          </span>
        ) : null}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {inline ? title : null}
        {!value && emptyAside ? emptyAside : null}
        {hint && (value || !emptyAside) ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
        {small && !value ? (
          <p className="text-xs text-muted-foreground">{t("media.field.dropHint")}</p>
        ) : null}
        {value && removable ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={working}
              className="text-destructive-text"
              aria-label={t("media.field.removeOf", { label })}
              onClick={() => {
                onChange(null)
              }}
            >
              <Trash2 />
              {t("media.field.remove")}
            </Button>
          </div>
        ) : null}
        {value ? children : null}
      </div>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        title={pickerTitle ?? label}
        svg={svg}
        onSelect={([asset]) => {
          if (asset) {
            onChange(asset)
          }
        }}
      />
    </div>
  )
}
