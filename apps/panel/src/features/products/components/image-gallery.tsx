import { CircleCheck, ImagePlus, Loader2 } from "lucide-react"
import { useState } from "react"
import type { DragEvent } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { MediaPicker } from "@/components/patterns/media-picker"
import { useRevealTarget } from "@/components/patterns/use-section-open"
import { registerMedia } from "@/features/products/api/media"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"
import { cn } from "@/lib/utils"
import { GalleryTile } from "./gallery-tile"
import type { GalleryImage } from "./gallery-tile"

export type { GalleryImage } from "./gallery-tile"

export const MAX_IMAGES = 20

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files")

interface ImageGalleryProps {
  images: GalleryImage[]
  onAdd: (stored: { id: string; url: string }[]) => void
  onRemove: (index: number) => void
  onMakeMain: (index: number) => void
  onMove: (from: number, to: number) => void
  /** Saves a picture's alt text (the product page); without it the tiles have none. */
  onAlt?: (index: number, alt: string) => void
  /** A save in flight elsewhere; the gallery waits for it. */
  disabled?: boolean
  /** The grid runs the page's width: more pictures to a row. */
  wide?: boolean
  /** The advisor's "alt text missing" lands here: the first picture without one opens. */
  altTarget?: string
}

/**
 * A product's pictures (docs/18 §7, one way to add a picture): the drop
 * zone, or the last tile once there are pictures, opens the media
 * dialog on a click (library, upload, address); files dropped on it go
 * up at once. Tiles are dragged into order, the first is the main
 * picture; a click on one opens its alt text and its actions.
 */
export function ImageGallery({
  images,
  onAdd,
  onRemove,
  onMakeMain,
  onMove,
  onAlt,
  disabled = false,
  wide = false,
  altTarget,
}: ImageGalleryProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [over, setOver] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const [target, setTarget] = useState<number | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const room = MAX_IMAGES - images.length
  const missing = onAlt ? images.filter((image) => image.alt && !image.alt.value.trim()) : []
  useRevealTarget(altTarget ?? "", () => {
    const first = missing.find((image) => !image.alt?.legacy)
    if (altTarget && first) {
      setOpenKey(first.key)
    }
  })

  const upload = async (files: File[]) => {
    if (files.length === 0 || room <= 0) {
      return
    }
    setBusy(true)
    try {
      const { files: stored } = await sdk.admin.upload.create({ files: files.slice(0, room) })
      let urls = stored.map((file) => file.url)
      try {
        // Product images get an alt text and versions (F3.3), under the address the
        // server keeps for them; the upload stands without them
        const { media } = await registerMedia(stored.map((file) => file.id))
        urls = media.map((each) => each.url)
      } catch (failure) {
        toast.warning(`${t("products.media.registerFailed")} ${errorText(t, failure)}`)
      }
      onAdd(stored.map((file, index) => ({ id: file.id, url: urls[index] ?? file.url })))
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setBusy(false)
    }
  }
  const working = busy || disabled
  // Files dragged in from the computer; a tile dragged within the grid is not one
  const fileDrop = {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (hasFiles(event)) {
        event.preventDefault()
        setOver(true)
      }
    },
    onDragLeave: () => {
      setOver(false)
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (hasFiles(event)) {
        event.preventDefault()
        setOver(false)
        void upload(Array.from(event.dataTransfer.files))
      }
    },
  }
  const zone = (compact: boolean) => (
    <button
      type="button"
      disabled={working || room <= 0}
      aria-label={t("products.media.addLabel", { max: MAX_IMAGES })}
      onClick={() => {
        setPicking(true)
      }}
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
      {compact ? null : (
        <span className="text-xs text-muted-foreground">{t("products.media.types")}</span>
      )}
    </button>
  )

  return (
    <div className="flex flex-col gap-3" {...fileDrop}>
      {images.length === 0 ? (
        zone(false)
      ) : (
        <ul
          id={altTarget}
          className={cn(
            "grid scroll-mt-28 grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6",
            // The page's width (a product's media card): more to a row, each a thumbnail's size
            wide && "md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9"
          )}
        >
          {images.map((image, index) => (
            <GalleryTile
              key={image.key}
              image={image}
              index={index}
              count={images.length}
              disabled={working}
              withAlt={Boolean(onAlt)}
              open={openKey === image.key}
              onOpenChange={(open) => {
                setOpenKey(open ? image.key : null)
              }}
              dragging={dragging === index}
              target={target === index && dragging !== null && dragging !== index}
              drag={{
                start: () => {
                  setDragging(index)
                },
                over: () => {
                  setTarget(index)
                },
                end: () => {
                  setDragging(null)
                  setTarget(null)
                },
                drop: () => {
                  if (dragging !== null && dragging !== index) {
                    onMove(dragging, index)
                  }
                  setDragging(null)
                  setTarget(null)
                },
              }}
              onMakeMain={() => {
                onMakeMain(index)
              }}
              onMove={(to) => {
                onMove(index, to)
              }}
              onRemove={() => {
                setOpenKey(null)
                onRemove(index)
              }}
              onAlt={(alt) => {
                onAlt?.(index, alt)
              }}
            />
          ))}
          {room > 0 ? <li>{zone(true)}</li> : null}
        </ul>
      )}
      {images.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            {t(onAlt ? "products.media.tilesHint" : "products.media.tilesHintNoAlt")}
          </span>
          {onAlt ? (
            missing.length > 0 ? (
              <span className="text-warning-text">
                {t("products.media.altMissing", { count: missing.length })}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-success-text">
                <CircleCheck className="size-3.5" aria-hidden="true" />
                {t("products.media.altComplete")}
              </span>
            )
          ) : null}
        </div>
      ) : null}
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        multiple
        max={Math.max(1, room)}
        title={t("products.media.pickerTitle")}
        onSelect={(assets) => {
          // A picture the product has already is not added twice
          const shown = new Set(images.map((image) => image.url))
          const fresh = assets.filter((asset) => !shown.has(asset.url)).slice(0, room)
          if (fresh.length > 0) {
            onAdd(fresh.map((asset) => ({ id: asset.file_id ?? asset.id, url: asset.url })))
          }
        }}
      />
    </div>
  )
}
