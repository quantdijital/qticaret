import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { serviceName } from "@/features/ai/failure-text"
import { SEO_FILL_LIMITS } from "@/features/seo/api/seo-fill"
import type { OpenSeoSuggestion } from "@/features/seo/api/seo-fill"

export interface SeoFillRowProps {
  suggestion: OpenSeoSuggestion
  /** The candidate picked, by its place among those offered. */
  picked: number
  onPick: (index: number) => void
  /** The text as it stands: the picked candidate, or what was typed over it. */
  text: string
  onText: (text: string) => void
  onUse: () => void
  onDismiss: () => void
  /** This row is being saved or dismissed, or the whole list is. */
  busy: boolean
}

const R = "seo.aiFill"

/**
 * One search text to decide on: the page, the field and its text now, the
 * candidates to pick from, the text (editable) and Kullan / Vazgeç. Kullan
 * saves what the field holds, not the candidate as it came.
 */
export function SeoFillRow({
  suggestion,
  picked,
  onPick,
  text,
  onText,
  onUse,
  onDismiss,
  busy,
}: SeoFillRowProps) {
  const { t } = useTranslation()
  const { name, current } = suggestion.entity
  const field = t(`${R}.fields.${suggestion.task}`)
  const fieldId = `seo-fill-${suggestion.id}`
  const limits = SEO_FILL_LIMITS[suggestion.task]
  const length = text.trim().length
  return (
    <li className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={fieldId} className="min-w-0 truncate text-[13px] font-medium">
          {name}
          <span className="ml-2 text-xs font-normal text-muted-foreground">{field}</span>
        </label>
        <span className="text-xs text-muted-foreground">
          {current ? t(`${R}.current`, { text: current }) : t(`${R}.currentEmpty`)}
        </span>
      </div>
      {suggestion.candidates.length > 1 ? (
        <div
          role="group"
          aria-label={t(`${R}.candidates`, { name })}
          className="flex flex-col gap-1"
        >
          {suggestion.candidates.map((candidate, index) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={picked === index}
              disabled={busy}
              onClick={() => {
                onPick(index)
              }}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-muted/60",
                picked === index ? "border-primary bg-primary/5" : "bg-background"
              )}
            >
              {candidate}
            </button>
          ))}
        </div>
      ) : null}
      <Textarea
        id={fieldId}
        value={text}
        rows={suggestion.task === "seo_title" ? 1 : 2}
        maxLength={limits.max}
        disabled={busy}
        aria-label={t(`${R}.field`, { name, field })}
        onChange={(event) => {
          onText(event.target.value)
        }}
        className="min-h-0 resize-none"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className={cn(length > limits.shown && "text-warning-text")}>
            {t(`${R}.length`, { length, shown: limits.shown })}
          </span>
          {" · "}
          {t("ai.suggest.from", { name: serviceName(t, suggestion.service) })}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || length === 0}
            aria-label={t(`${R}.useOne`, { name, field })}
            onClick={onUse}
          >
            {t("ai.suggest.use")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="cancel"
            disabled={busy}
            aria-label={t(`${R}.dismissOne`, { name, field })}
            onClick={onDismiss}
          >
            {t("ai.suggest.dismiss")}
          </Button>
        </div>
      </div>
    </li>
  )
}
