import { useTranslation } from "react-i18next"
import { MediaField } from "@/components/patterns/media-field"
import type { LayoutImage } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS } from "@/features/storefront/api/layout"
import { F, TextField } from "./fields"

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

/**
 * An image of the section: chosen from the media library, this computer or
 * an address (the library is the only source a section may use), replaced
 * or taken off, with the words that describe it. A library image's own alt
 * text fills an empty one.
 */
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
  // Its box carries the id: the settings search and the preview's field label land on it
  return (
    <div id={id}>
      <MediaField
        id={id}
        label={label}
        hint={hint}
        value={image?.url ?? null}
        emptyText={t(`${F}.noImage`)}
        removable={removable}
        onChange={(asset) => {
          const own = image?.alt?.trim() ? image.alt : null
          onChange(asset ? { url: asset.url, alt: own ?? asset.alt } : null)
        }}
      >
        {image ? (
          <TextField
            id={`${id}-alt`}
            label={t(`${F}.alt`)}
            hint={t(`${F}.altHint`)}
            placeholder={t(`${F}.altPlaceholder`)}
            value={image.alt}
            max={LAYOUT_LIMITS.alt}
            error={altError}
            onChange={(alt) => {
              onChange({ ...image, alt })
            }}
          />
        ) : null}
      </MediaField>
    </div>
  )
}
