import { ChevronRight, CircleCheck, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Input } from "@/components/ui/input"
import { useSaveAlt } from "@/features/products/api/media"
import type { ProductMedia } from "@/features/products/api/media"
import { errorText } from "@/lib/errors"
import { cn } from "@/lib/utils"

// What screen readers read comfortably; the server allows no more
const ALT_MAX = 250

function AltRow({
  productId,
  url,
  media,
  position,
}: {
  productId: string
  url: string
  media: ProductMedia | undefined
  position: number
}) {
  const { t } = useTranslation()
  const save = useSaveAlt(productId)
  const stored = media?.alt ?? ""
  const [draft, setDraft] = useState(stored)
  const commit = () => {
    const next = draft.trim()
    if (!media || next === stored) {
      return
    }
    save.mutate(
      { id: media.id, alt: next },
      {
        onSuccess: () => toast.success(t("products.media.altSaved")),
        onError: (failure) => {
          toast.error(errorText(t, failure))
          setDraft(stored)
        },
      }
    )
  }
  const inputId = `alt-${String(position)}`
  return (
    <li className="flex items-start gap-3 py-3">
      <img src={url} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor={inputId} className="text-xs text-muted-foreground">
          {t("products.media.altLabel", { position })}
        </label>
        <div className="relative">
          <Input
            id={inputId}
            value={draft}
            maxLength={ALT_MAX}
            disabled={!media || save.isPending}
            placeholder={media ? t("products.media.altPlaceholder") : t("products.media.altLegacy")}
            onChange={(event) => {
              setDraft(event.target.value)
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                commit()
              }
            }}
          />
          {save.isPending ? (
            <Loader2 className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      </div>
      {media?.file_id ? (
        <span className="mt-6 shrink-0">
          {media.derived_at ? (
            <StatusBadge tone="success">{t("products.media.versionsReady")}</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">{t("products.media.versionsPending")}</StatusBadge>
          )}
        </span>
      ) : null}
    </li>
  )
}

/**
 * Each image's alt text (docs/13 §8): what a screen reader says and what
 * image search reads; saved on leaving the field. The state of its
 * WebP/AVIF versions and share crop beside it. Folded once every picture
 * has one (the owner, 2026-11-04: the list ran the page long); open while
 * one is missing.
 */
export function AltTexts({
  productId,
  images,
  media,
}: {
  productId: string
  images: { key: string; url: string }[]
  media: ProductMedia[]
}) {
  const { t } = useTranslation()
  const byUrl = new Map(media.map((each) => [each.url, each]))
  const missing = images.filter((image) => !byUrl.get(image.url)?.alt?.trim()).length
  // Every picture described: the list folds away, its state stays in sight
  const [open, setOpen] = useState(missing > 0)
  return (
    <section className="flex flex-col gap-1 border-t pt-4" aria-labelledby="alt-texts">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="alt-texts" className="text-sm font-medium">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="alt-texts-list"
            className="inline-flex items-center gap-1.5 rounded-sm hover:text-foreground/80"
            onClick={() => {
              setOpen(!open)
            }}
          >
            <ChevronRight
              className={cn("size-4 transition-transform", open && "rotate-90")}
              aria-hidden="true"
            />
            {t("products.media.altTitle")}
          </button>
        </h3>
        {missing > 0 ? (
          <span className="text-xs text-warning-text">
            {t("products.media.altMissing", { count: missing })}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-success-text">
            <CircleCheck className="size-3.5" aria-hidden="true" />
            {t("products.media.altComplete")}
          </span>
        )}
      </div>
      {open ? (
        <div id="alt-texts-list" className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{t("products.media.altHint")}</p>
          <ul className="flex flex-col divide-y">
            {images.map((image, index) => (
              <AltRow
                // A new alt text from the server starts the field again
                key={`${image.key}-${byUrl.get(image.url)?.alt ?? ""}`}
                productId={productId}
                url={image.url}
                media={byUrl.get(image.url)}
                position={index + 1}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
