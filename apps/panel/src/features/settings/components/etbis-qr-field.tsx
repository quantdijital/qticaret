import { ImagePlus, Trash2, Upload } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import { MediaPicker } from "@/components/patterns/media-picker"
import { cn } from "@qticaret/admin-ui/lib/utils"

const Q = "settings.store.etbisQr"

/**
 * The QR code ETBİS gives a registered shop (eticaret.gov.tr), as one thin
 * row of the legal identity (the owner, 2026-11-24): a small thumbnail, its
 * state and the buttons. Chosen the one way pictures are (`MediaPicker`:
 * library, upload, address); the storefront's footer shows it.
 */
export function EtbisQrField({
  url,
  onChange,
  className,
}: {
  url: string
  onChange: (url: string) => void
  className?: string
}) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  const label = t(`${Q}.title`)
  return (
    <Field
      label={label}
      htmlFor="legal-etbis_qr"
      hint={t(`${Q}.hint`)}
      {...(className ? { className } : {})}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border",
            // Cameras read dark modules on white, whatever the theme
            url ? "bg-white p-0.5" : "border-dashed text-muted-foreground"
          )}
        >
          {url ? (
            <img src={url} alt={label} className="size-full object-contain" />
          ) : (
            <ImagePlus className="size-4" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
          {t(url ? `${Q}.set` : `${Q}.none`)}
        </span>
        <div className="flex shrink-0 gap-2">
          <Button
            id="legal-etbis_qr"
            type="button"
            variant="outline"
            size="sm"
            aria-label={t(url ? "media.field.replaceOf" : "media.field.chooseOf", { label })}
            onClick={() => {
              setPicking(true)
            }}
          >
            <Upload />
            {t(url ? "media.field.replace" : `${Q}.choose`)}
          </Button>
          {url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive-text"
              aria-label={t("media.field.removeOf", { label })}
              onClick={() => {
                onChange("")
              }}
            >
              <Trash2 />
              {t("media.field.remove")}
            </Button>
          ) : null}
        </div>
      </div>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        title={label}
        onSelect={([asset]) => {
          if (asset) {
            onChange(asset.url)
          }
        }}
      />
    </Field>
  )
}
