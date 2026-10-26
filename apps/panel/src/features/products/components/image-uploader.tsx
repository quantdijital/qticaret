import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react"
import { useState } from "react"
import type { DragEvent } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { errorText } from "@/lib/errors"
import { registerMedia } from "@/features/products/api/media"
import { sdk } from "@/lib/sdk"
import { cn } from "@/lib/utils"

// What the server takes (docs/04 upload checks); it checks the bytes again
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif"
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
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:ring-2 focus-within:ring-ring/40",
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
}

/** Pictures in a grid: drop or pick files, the first is the main one. */
export function ImageUploader({
  images,
  onAdd,
  onRemove,
  onMakeMain,
  disabled = false,
}: ImageUploaderProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  const upload = async (files: File[]) => {
    const room = MAX_IMAGES - images.length
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
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
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
