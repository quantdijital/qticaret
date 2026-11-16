import { TriangleAlert, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { MediaField } from "@/components/patterns/media-field"
import { faviconRefusal, faviconWarnings } from "@/features/settings/favicon"

const F = "settings.store.brand.favicon"

/** The icon as a browser tab and a phone's home screen show it, measured as it loads. */
function Previews({
  url,
  name,
  onSize,
}: {
  url: string
  name: string
  onSize: (size: { width: number; height: number }) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">{t(`${F}.tab`)}</span>
        <div className="flex h-9 w-56 max-w-full items-center gap-2 rounded-t-md border border-b-0 bg-muted/60 px-3">
          <img
            src={url}
            alt=""
            className="size-4 shrink-0 object-contain"
            onLoad={(event) => {
              onSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }}
          />
          <span className="min-w-0 flex-1 truncate text-xs">{name}</span>
          <X className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t(`${F}.home`)}</span>
        <img src={url} alt="" className="size-12 rounded-xl border object-cover" />
      </div>
    </div>
  )
}

/**
 * The storefront's site icon (the owner, 2026-11-16): chosen as every
 * picture is, through its frame (`MediaField`); a type or size the server
 * refuses is said at once and not taken. Beside it, how a browser tab and
 * a phone show it, and a warning when it is not square or too small.
 */
export function StoreFaviconField({
  url,
  name,
  onChange,
}: {
  url: string
  /** The shop's name, as the tab shows it beside the icon. */
  name: string
  onChange: (url: string) => void
}) {
  const { t } = useTranslation()
  const [size, setSize] = useState<{ url: string; width: number; height: number } | null>(null)
  // Measured for this address only: a new choice is measured again as it loads
  const warnings = faviconWarnings(size?.url === url ? size : null)
  return (
    <MediaField
      id="store-favicon"
      label={t(`${F}.label`)}
      hint={t(`${F}.hint`)}
      value={url || null}
      frame="square"
      inline
      emptyText={t(`${F}.none`)}
      emptyAside={<p className="text-xs text-muted-foreground">{t(`${F}.empty`)}</p>}
      onChange={(asset) => {
        if (!asset) {
          onChange("")
          return
        }
        const refusal = faviconRefusal(asset)
        if (refusal) {
          toast.error(t(refusal))
          return
        }
        onChange(asset.url)
      }}
    >
      <Previews
        url={url}
        name={name}
        onSize={(next) => {
          setSize({ url, ...next })
        }}
      />
      {warnings.length > 0 ? (
        <p role="status" className="flex items-start gap-2 text-xs text-warning-text">
          <TriangleAlert className="h-lh w-3.5 shrink-0" aria-hidden="true" />
          <span>{warnings.map((key) => t(key)).join(" ")}</span>
        </p>
      ) : null}
    </MediaField>
  )
}
