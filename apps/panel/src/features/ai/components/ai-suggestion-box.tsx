import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { AiCandidates } from "@/features/ai/components/ai-candidates"
import { AiTryOthers } from "@/features/ai/components/ai-try-others"
import { aiFailureText, serviceName } from "@/features/ai/failure-text"
import type { AiSuggestionState } from "@/features/ai/use-ai-suggestion"

export interface AiSuggestionBoxProps {
  state: AiSuggestionState
  /** The task's ready options (`short`); none: no row. Never free text. */
  options?: readonly string[] | undefined
  option?: string | undefined
  onOption?: ((option: string) => void) | undefined
  /** "Kullan": with several candidates, the picked one is handed over; otherwise nothing. */
  onUse: (candidate?: string) => void
  onRetry: () => void
  onTryWith: (service: string) => void
  onDismiss: () => void
  /** A structured suggestion (a product card) drawn by its task; left out: the text, line by line. */
  preview?: ReactNode
}

/**
 * A suggestion and what to do with it (adr/0071 §13): the text, whose it
 * is ("Yapay zekâ önerisi · DeepSeek"), and Kullan / Yeniden dene /
 * Vazgeç. Several candidates (adr/0074 §4) are a radio list, the first
 * picked; "Kullan" takes the picked one. A refusal or a failure says why
 * in a sentence; "Başka servisle dene" only when the backend named other
 * services, and only on a click.
 */
export function AiSuggestionBox(props: AiSuggestionBoxProps) {
  const {
    state,
    options = [],
    option,
    onOption,
    onUse,
    onRetry,
    onTryWith,
    onDismiss,
    preview,
  } = props
  const { t } = useTranslation()
  // The pick belongs to one suggestion: a new one starts at its first candidate
  const [picked, setPicked] = useState<{ id: string; text: string } | null>(null)
  const busy = state.status === "loading"
  const alternatives =
    state.status === "refused" || state.status === "error" ? state.alternatives : []
  const suggestion = state.status === "suggestion" ? state.suggestion : null
  const candidates = suggestion?.candidates ?? []
  const several = candidates.length > 1
  const chosen =
    suggestion && picked?.id === suggestion.id && candidates.includes(picked.text)
      ? picked.text
      : (candidates[0] ?? "")

  return (
    <div className="flex flex-col gap-3" data-slot="ai-suggestion-box">
      {options.length > 0 && onOption ? (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={option ?? ""}
          disabled={busy}
          aria-label={t("ai.suggest.option")}
          onValueChange={(next) => {
            if (next && next !== option) {
              onOption(next)
            }
          }}
          className="w-full"
        >
          {options.map((each) => (
            <ToggleGroupItem key={each} value={each} className="flex-1">
              {t(`ai.options.${each}`, { defaultValue: each })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}

      <div role="status" aria-live="polite" aria-busy={busy} className="flex flex-col gap-2">
        {state.status === "loading" || state.status === "idle" ? (
          <>
            <span className="sr-only">{t("ai.suggest.loading")}</span>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </>
        ) : null}
        {state.status === "suggestion" ? (
          <>
            <p className="text-xs text-muted-foreground">
              {t("ai.suggest.from", { name: serviceName(t, state.suggestion.service) })}
            </p>
            {/* A long text (a product description) scrolls inside, reachable by keyboard;
                its lines are paragraphs, shown apart as the editor will show them */}
            <div
              tabIndex={0}
              data-scroll-area="y"
              className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto rounded-md border bg-muted/40 px-3 py-2 text-sm break-words focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {several ? (
                <AiCandidates
                  candidates={candidates}
                  value={chosen}
                  onChange={(text) => {
                    setPicked({ id: state.suggestion.id, text })
                  }}
                />
              ) : (
                (preview ??
                state.suggestion.text.split("\n").map((line, index) => <p key={index}>{line}</p>))
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("ai.suggest.note")}</p>
          </>
        ) : null}
        {state.status === "refused" ? <p className="text-sm">{t("ai.suggest.refused")}</p> : null}
        {state.status === "error" ? (
          <p className="text-sm text-destructive">
            {aiFailureText(t, state.failure, state.service)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {state.status === "suggestion" ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (several) {
                onUse(chosen)
              } else {
                onUse()
              }
            }}
          >
            {t("ai.suggest.use")}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onRetry}>
          {t("ai.suggest.retry")}
        </Button>
        <Button type="button" size="sm" variant="cancel" onClick={onDismiss}>
          {t("ai.suggest.dismiss")}
        </Button>
      </div>

      <AiTryOthers services={alternatives} onTryWith={onTryWith} className="border-t pt-3" />
    </div>
  )
}
