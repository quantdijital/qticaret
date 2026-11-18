import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@qticaret/admin-ui/ui/input"
import { AiButton } from "@/features/ai/components/ai-button"
import type { GalleryImage } from "./gallery-tile"

// What screen readers read comfortably; the server allows no more
const ALT_MAX = 250

/** The alt text in the tile's popover: saved on Enter, on leaving the field, on closing. */
export function AltField({
  image,
  position,
  onAlt,
}: {
  image: GalleryImage
  position: number
  onAlt: (alt: string) => void
}) {
  const { t } = useTranslation()
  const stored = image.alt?.value ?? ""
  const [draft, setDraft] = useState(stored)
  const commit = () => {
    if (draft.trim() !== stored.trim()) {
      onAlt(draft.trim())
    }
  }
  const id = `gallery-alt-${String(position)}`
  const field = useRef<HTMLInputElement>(null)
  const mediaId = image.alt?.legacy ? null : (image.alt?.mediaId ?? null)
  const input = (
    <Input
      ref={field}
      id={id}
      value={draft}
      maxLength={ALT_MAX}
      disabled={image.alt?.legacy}
      placeholder={t(
        image.alt?.legacy ? "products.media.altLegacy" : "products.media.altPlaceholder"
      )}
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
  )
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {t("products.media.altLabel", { position })}
      </label>
      {mediaId ? (
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">{input}</div>
          <AiButton
            task="image_alt_text"
            entity={{ type: "media", id: mediaId }}
            size="icon"
            label={t("products.media.altAi", { position })}
            note={t("ai.suggest.imageNote")}
            onUse={(text) => {
              // Into the field only: it is saved as a typed text is, on Enter or on leaving it
              setDraft(text)
              requestAnimationFrame(() => field.current?.focus())
            }}
          />
        </div>
      ) : (
        input
      )}
      <p className="text-xs text-muted-foreground">{t("products.media.altHint")}</p>
    </div>
  )
}
