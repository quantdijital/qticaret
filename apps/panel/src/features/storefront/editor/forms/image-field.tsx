import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { LayoutImage } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS } from "@/features/storefront/api/layout"
import { F, TextField } from "./fields"
import { useImageUpload } from "./use-image-upload"

interface ImageFieldProps {
  id: string
  label: string
  hint?: string | undefined
  image: LayoutImage | null
  onChange: (image: LayoutImage | null) => void
  /** An image the section needs (a slide's) is replaced, never taken off. */
  removable?: boolean
  altError?: string | undefined
}

/** An image of the section: uploaded, replaced or taken off, with the words that describe it. */
export function ImageField({
  id,
  label,
  hint,
  image,
  onChange,
  removable = true,
  altError,
}: ImageFieldProps) {
  const { t } = useTranslation()
  const upload = useImageUpload((url) => {
    onChange({ url, alt: image?.alt ?? null })
  })
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {image ? (
        <img
          src={image.url}
          alt=""
          className="aspect-[16/9] w-full rounded-md border bg-muted object-cover"
        />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center rounded-md border border-dashed px-4 text-center text-[13px] text-muted-foreground">
          {t(`${F}.noImage`)}
        </div>
      )}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {upload.input}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.uploading}
          aria-label={t(image ? `${F}.replaceOf` : `${F}.uploadOf`, { label })}
          onClick={upload.choose}
        >
          {upload.uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {t(image ? `${F}.replace` : `${F}.upload`)}
        </Button>
        {image && removable ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive-text"
            onClick={() => {
              onChange(null)
            }}
          >
            <Trash2 />
            {t(`${F}.removeImage`)}
          </Button>
        ) : null}
      </div>
      {image ? (
        <TextField
          id={`${id}-alt`}
          label={t(`${F}.alt`)}
          hint={t(`${F}.altHint`)}
          value={image.alt}
          max={LAYOUT_LIMITS.alt}
          error={altError}
          onChange={(alt) => {
            onChange({ ...image, alt })
          }}
        />
      ) : null}
    </div>
  )
}
