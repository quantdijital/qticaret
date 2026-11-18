import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { serviceName } from "@/features/ai/failure-text"
import { ALT_MAX_LENGTH } from "@/features/media/api/alt-review"
import type { OpenAltSuggestion } from "@/features/media/api/alt-review"

export interface AltReviewRowProps {
  suggestion: OpenAltSuggestion
  /** The text as it stands: the suggestion, or what was typed over it. */
  text: string
  onText: (text: string) => void
  onUse: () => void
  onDismiss: () => void
  /** This row is being saved or dismissed, or the whole list is. */
  busy: boolean
}

const R = "ai.altReview"

/**
 * One suggestion to decide on: the picture, its name, the text (editable,
 * one line in sense though it may wrap), and Kullan / Vazgeç. Kullan saves
 * what the field holds, not the suggestion as it came.
 */
export function AltReviewRow({
  suggestion,
  text,
  onText,
  onUse,
  onDismiss,
  busy,
}: AltReviewRowProps) {
  const { t } = useTranslation()
  const name = suggestion.media.filename
  const fieldId = `alt-review-${suggestion.id}`
  const empty = text.trim() === ""
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
      <img
        src={suggestion.media.url}
        alt=""
        loading="lazy"
        className="size-20 shrink-0 rounded-md border bg-muted object-contain"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor={fieldId} className="truncate text-[13px] font-medium">
          {name}
        </label>
        <Textarea
          id={fieldId}
          value={text}
          rows={2}
          maxLength={ALT_MAX_LENGTH}
          disabled={busy}
          aria-label={t(`${R}.field`, { name })}
          onChange={(event) => {
            onText(event.target.value)
          }}
          className="min-h-0 resize-none"
        />
        <p className="text-xs text-muted-foreground">
          {t("ai.suggest.from", { name: serviceName(t, suggestion.service) })}
        </p>
      </div>
      <div className="flex shrink-0 gap-2 sm:flex-col">
        <Button
          type="button"
          size="sm"
          disabled={busy || empty}
          aria-label={t(`${R}.useOne`, { name })}
          onClick={onUse}
        >
          {t("ai.suggest.use")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          aria-label={t(`${R}.dismissOne`, { name })}
          onClick={onDismiss}
        >
          {t("ai.suggest.dismiss")}
        </Button>
      </div>
    </li>
  )
}
