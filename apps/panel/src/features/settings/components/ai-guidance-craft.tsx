import { ChevronRight, RotateCcw, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Alert, AlertAction, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { craftOutdated } from "@/features/ai/api/crafts"
import type { DefaultCraft } from "@/features/ai/api/crafts"
import { GUIDANCE_LIMITS } from "@/features/ai/api/guidance"
import type { AiTaskGuidance } from "@/features/ai/api/guidance"
import { GuidanceText } from "@/features/settings/components/ai-guidance-text"

const C = "ai.guidance.tasks.craft"

/** Text the shop cannot change, shown as it goes: line breaks kept, nothing to type in. */
function FixedText({ label, hint, text }: { label: string; hint?: string; text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className="rounded-md border bg-muted px-3 py-2 text-xs leading-5 whitespace-pre-wrap text-muted-foreground">
        {text}
      </div>
    </div>
  )
}

/**
 * A text task's "Gelişmiş" part in Settings › Yapay zekâ › Yazım yönergesi
 * › İşlere göre (adr/0074 §3), the owner's only: closed until opened; the
 * task's instruction in an editor that starts from the default ("value"
 * null: the default, untouched), "Varsayılana dön", and under it what is
 * always added whatever it says. When a deploy moved the default past the
 * version the owner's text was written against, a warning offers the new
 * default to read, to take, or to keep one's own. Nothing is saved here:
 * the card's one save sends it.
 */
export function AiGuidanceCraft({
  standard,
  saved,
  value,
  kept,
  disabled,
  onChange,
  onKeep,
}: {
  /** The task's default; none yet (loading) or none at all: nothing is drawn. */
  standard: DefaultCraft | undefined
  /** The task's guidance as saved: its instruction and the version it was written against. */
  saved: AiTaskGuidance | undefined
  value: string | null
  /** The owner chose to keep theirs over the new default (sent with the save). */
  kept: boolean
  disabled: boolean
  onChange: (next: string | null) => void
  onKeep: () => void
}) {
  const { t } = useTranslation()
  const [showNew, setShowNew] = useState(false)
  if (!standard) {
    return null
  }
  const own = value !== null
  // Said while one's own text stands: taking the new default (unsaved) answers it too
  const outdated = own && !kept && craftOutdated(saved, standard)
  return (
    <details className="group/craft border-t pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open/craft:rotate-90"
        />
        <span className="font-medium">{t(`${C}.title`)}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {own ? t(`${C}.edited`) : t(`${C}.default`)}
        </span>
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">{t(`${C}.hint`)}</p>
        {outdated ? (
          <Alert role="status" className="border-warning/40 [&>svg]:text-warning-text">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription className="text-foreground">{t(`${C}.outdated`)}</AlertDescription>
            <AlertAction>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-expanded={showNew}
                onClick={() => {
                  setShowNew((open) => !open)
                }}
              >
                {t(showNew ? `${C}.hideNew` : `${C}.showNew`)}
              </Button>
            </AlertAction>
          </Alert>
        ) : null}
        {outdated && showNew ? (
          <div className="flex flex-col gap-2">
            <FixedText label={t(`${C}.newDefault`)} text={standard.craft} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  onChange(null)
                }}
              >
                {t(`${C}.useNew`)}
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onKeep}>
                {t(`${C}.keep`)}
              </Button>
            </div>
          </div>
        ) : null}
        <GuidanceText
          label={t(`${C}.label`)}
          value={value ?? standard.craft}
          max={GUIDANCE_LIMITS.craft}
          rows={10}
          disabled={disabled}
          onChange={(next) => {
            // The default as it is: no instruction of one's own
            onChange(next === standard.craft ? null : next)
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          disabled={disabled || !own}
          onClick={() => {
            onChange(null)
          }}
        >
          <RotateCcw />
          {t(`${C}.reset`)}
        </Button>
        <FixedText
          label={t(`${C}.rules`)}
          hint={t(`${C}.rulesHint`)}
          text={`${standard.data_rule}\n\n${standard.rules}`}
        />
      </div>
    </details>
  )
}
