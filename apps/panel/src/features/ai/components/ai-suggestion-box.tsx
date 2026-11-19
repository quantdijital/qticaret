import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { AiTryOthers } from "@/features/ai/components/ai-try-others"
import { aiFailureText, serviceName } from "@/features/ai/failure-text"
import type { AiSuggestionState } from "@/features/ai/use-ai-suggestion"

export interface AiSuggestionBoxProps {
  state: AiSuggestionState
  /** The task's ready options (`short`); none: no row. Never free text. */
  options?: readonly string[] | undefined
  option?: string | undefined
  onOption?: ((option: string) => void) | undefined
  onUse: () => void
  onRetry: () => void
  onTryWith: (service: string) => void
  onDismiss: () => void
  /** A structured suggestion (a product card) drawn by its task; left out: the text, line by line. */
  preview?: ReactNode
  /**
   * Each line is a choice of its own (a focus keyword and its alternatives):
   * every line gets its own "Kullan", which hands that line to `onUseChoice`.
   */
  onUseChoice?: ((line: string) => void) | undefined
}

/** The lines of a choice suggestion, the main one first. */
function Choices({ text, onUse }: { text: string; onUse: (line: string) => void }) {
  const { t } = useTranslation()
  const lines = text.split("\n").filter((line) => line.trim() !== "")
  return (
    <ul aria-label={t("ai.suggest.choices")} className="flex flex-col gap-1.5">
      {lines.map((line, index) => (
        <li key={line} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 break-words">
            {line}
            {index === 0 ? (
              <span className="ml-1.5 text-xs whitespace-nowrap text-muted-foreground">
                {t("ai.suggest.mainChoice")}
              </span>
            ) : null}
          </span>
          <Button
            type="button"
            size="sm"
            variant={index === 0 ? "default" : "outline"}
            className="h-7 shrink-0 text-xs"
            aria-label={t("ai.suggest.useChoice", { text: line })}
            onClick={() => {
              onUse(line)
            }}
          >
            {t("ai.suggest.use")}
          </Button>
        </li>
      ))}
    </ul>
  )
}

/**
 * A suggestion and what to do with it (adr/0071 §13): the text, whose it
 * is ("Yapay zekâ önerisi · DeepSeek"), and Kullan / Yeniden dene /
 * Vazgeç. A refusal or a failure says why in a sentence; "Başka servisle
 * dene" only when the backend named other services, and only on a click.
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
    onUseChoice,
  } = props
  const { t } = useTranslation()
  const busy = state.status === "loading"
  const alternatives =
    state.status === "refused" || state.status === "error" ? state.alternatives : []

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
              className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto rounded-md border bg-muted/40 px-3 py-2 text-sm break-words focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {onUseChoice ? (
                <Choices text={state.suggestion.text} onUse={onUseChoice} />
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
        {state.status === "suggestion" && !onUseChoice ? (
          <Button type="button" size="sm" onClick={onUse}>
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
