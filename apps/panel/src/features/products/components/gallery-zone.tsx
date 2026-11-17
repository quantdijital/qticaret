import { ImagePlus, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"

/**
 * The gallery's way in (docs/18 §7): the wide drop zone while it is empty,
 * the grid's last tile after; a click opens the media dialog. `label` and
 * `types` name what it takes (pictures, or pictures and videos).
 */
export function GalleryZone({
  compact,
  busy,
  disabled,
  over,
  label,
  types,
  onOpen,
}: {
  compact: boolean
  busy: boolean
  disabled: boolean
  /** Files are dragged over the gallery. */
  over: boolean
  label: string
  types: string
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={onOpen}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center transition-colors outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
        compact ? "aspect-square px-2" : "px-6 py-10",
        over ? "border-primary bg-accent" : "border-border hover:border-input hover:bg-muted/50"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-accent text-accent-foreground",
          compact ? "size-8" : "size-12"
        )}
      >
        {busy ? (
          <Loader2 className={compact ? "size-4 animate-spin" : "size-5 animate-spin"} />
        ) : (
          <ImagePlus className={compact ? "size-4" : "size-5"} aria-hidden="true" />
        )}
      </span>
      <span className={compact ? "text-xs font-medium" : "text-sm font-medium"}>
        {t(compact ? "products.media.addShort" : "products.media.drop")}
      </span>
      {compact ? null : <span className="text-xs text-muted-foreground">{types}</span>}
    </button>
  )
}
