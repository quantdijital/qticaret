import { ImagePlus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { Button } from "@qticaret/admin-ui/ui/button"
import { MediaPicker } from "@/components/patterns/media-picker"
import type { ProgramImage } from "@/features/products/api/program"

const P = "products.program"

/**
 * A step's picture, kept small (the owner, 2026-11-28: an empty frame on
 * every day made a long program endless): without one, a single "Görsel
 * ekle"; with one, a small thumbnail that replaces it and "Kaldır". Both
 * choose from the media library, as every picture of a form does.
 */
export function StepImage({
  id,
  value,
  onChange,
}: {
  id: string
  value: ProgramImage | null
  onChange: (next: ProgramImage | null) => void
}) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  const label = t(`${P}.image`)
  const pick = () => {
    setPicking(true)
  }
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span id={`${id}-label`} className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <InfoTip name={label} hint={t(`${P}.imageHint`)} />
      </div>
      {value ? (
        <div className="flex items-end gap-2">
          <button
            type="button"
            aria-label={t("media.field.replaceOf", { label })}
            onClick={pick}
            className="size-24 shrink-0 overflow-hidden rounded-md border bg-muted outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <img src={value.url} alt={value.alt ?? label} className="size-full object-cover" />
          </button>
          <div className="flex flex-col gap-1">
            <Button type="button" variant="outline" size="xs" onClick={pick}>
              {t("media.field.replace")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-destructive-text"
              aria-label={t("media.field.removeOf", { label })}
              onClick={() => {
                onChange(null)
              }}
            >
              <Trash2 aria-hidden="true" />
              {t("media.field.remove")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          aria-label={t("media.field.chooseOf", { label })}
          onClick={pick}
        >
          <ImagePlus aria-hidden="true" />
          {t(`${P}.addImage`)}
        </Button>
      )}
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        title={label}
        onSelect={([asset]) => {
          if (asset) {
            onChange({ url: asset.url, alt: asset.alt ?? null })
          }
        }}
      />
    </div>
  )
}
