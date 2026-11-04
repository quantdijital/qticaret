import { FolderOpen, ImagePlus, Loader2, Star, Trash2 } from "lucide-react"
import { useState } from "react"
import type { DragEvent } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { MediaPicker } from "@/components/patterns/media-picker"
import { Button } from "@/components/ui/button"
import { IMAGE_ACCEPT as ACCEPT } from "@/features/media/api/media"
import { errorText } from "@/lib/errors"
import { registerMedia } from "@/features/products/api/media"
import { sdk } from "@/lib/sdk"
import { cn } from "@/lib/utils"

export const MAX_IMAGES = 20

export interface UploadedImage {
  key: string
  url: string
}

function DropZone({ onFiles, busy }: { onFiles: (files: File[]) => void; busy: boolean }) {
  const { t } = useTranslation()
  const [over, setOver] = useState(false)
  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setOver(false)
    onFiles(Array.from(event.dataTransfer.files))
  }
  return (
    <label
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => {
        setOver(false)
      }}
      onDrop={drop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
        over ? "border-primary bg-accent" : "border-border hover:border-input hover:bg-muted/50"
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
      </span>
      <span className="text-sm font-medium">{t("products.media.drop")}</span>
      <span className="text-xs text-muted-foreground">{t("products.media.types")}</span>
      <input
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []))
          event.target.value = ""
        }}
      />
    </label>
  )
}

interface ImageUploaderProps {
  images: UploadedImage[]
  onAdd: (stored: { id: string; url: string }[]) => void
  onRemove: (index: number) => void
  onMakeMain: (index: number) => void
  /** A save in flight elsewhere; the grid waits for it. */
  disabled?: boolean
  /** The grid runs the page's width: more pictures to a row. */
  wide?: boolean
}

/** Pictures in a grid: drop or pick files, the first is the main one. */
export function ImageUploader({
  images,
  onAdd,
  onRemove,
  onMakeMain,
  disabled = false,
  wide = false,
}: ImageUploaderProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const room = MAX_IMAGES - images.length

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

  return (
    <div className="flex flex-col gap-5">
      <DropZone onFiles={(files) => void upload(files)} busy={busy || disabled} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || disabled || room <= 0}
          onClick={() => {
            setPicking(true)
          }}
        >
          <FolderOpen />
          {t("products.media.fromLibrary")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("products.media.fromLibraryHint")}</span>
      </div>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        multiple
        max={Math.max(1, room)}
        title={t("products.media.fromLibrary")}
        onSelect={(assets) => {
          // A picture the product has already is not added twice
          const shown = new Set(images.map((image) => image.url))
          const fresh = assets.filter((asset) => !shown.has(asset.url)).slice(0, room)
          if (fresh.length > 0) {
            onAdd(fresh.map((asset) => ({ id: asset.file_id ?? asset.id, url: asset.url })))
          }
        }}
      />
      {images.length > 0 ? (
        <ul
          className={cn(
            "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6",
            // The page's width (a product's media card): more to a row, each a thumbnail's size
            wide && "md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10"
          )}
        >
          {images.map((image, index) => (
            <li
              key={image.key}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-muted",
                index === 0 && "ring-2 ring-primary ring-offset-2 ring-offset-card"
              )}
            >
              <img src={image.url} alt="" className="aspect-square w-full object-cover" />
              {index === 0 ? (
                <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                  {t("products.media.main")}
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                {index > 0 ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-7"
                    disabled={disabled}
                    aria-label={t("products.media.makeMain")}
                    onClick={() => {
                      onMakeMain(index)
                    }}
                  >
                    <Star className="size-3.5" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="size-7"
                  disabled={disabled}
                  aria-label={t("products.media.remove")}
                  onClick={() => {
                    onRemove(index)
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
