import { Check, Sparkles, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import type { AiAttributeValue } from "@/features/ai/attribute-values"
import { AiConnectHint } from "@/features/ai/components/ai-connect-hint"
import { AiServicePicker } from "@/features/ai/components/ai-service-picker"
import { AiTryOthers } from "@/features/ai/components/ai-try-others"
import { aiFailureText, serviceName } from "@/features/ai/failure-text"
import type { AttributeDefinition } from "@/features/attributes/types"
import { suggestionText } from "@/features/attributes/use-attributes-ai"
import type { AttributesAi } from "@/features/attributes/use-attributes-ai"

/** The card's button: asks, or closes the suggestions when they are open. */
export function AttributesAiButton({ ai }: { ai: AttributesAi }) {
  const { t } = useTranslation()
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-expanded={ai.open}
      onClick={() => {
        if (ai.open) {
          ai.close()
        } else {
          ai.start()
        }
      }}
    >
      <Sparkles />
      {t("attributes.ai.fill")}
    </Button>
  )
}

/**
 * Above the fields: the state of the ask, the service picker, how many
 * values are offered and "Hepsini uygula"; closing is the cancel kind.
 */
export function AttributesAiBar({
  ai,
  offered,
  onApplyAll,
}: {
  ai: AttributesAi
  /** Fields with a value offered that are still empty in the form. */
  offered: number
  onApplyAll: () => void
}) {
  const { t } = useTranslation()
  if (!ai.open) {
    return null
  }
  if (ai.usable.length === 0) {
    return (
      <div className="rounded-md border p-3">
        <AiConnectHint onClose={ai.hideHint} />
      </div>
    )
  }
  const { state } = ai
  return (
    <section
      aria-label={t("attributes.ai.fill")}
      className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3"
      data-slot="ai-attributes"
    >
      <AiServicePicker
        services={ai.usable}
        value={ai.service}
        disabled={state.status === "loading"}
        onChange={ai.pick}
      />
      <div role="status" aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "loading" || state.status === "idle" ? (
          <>
            <span className="sr-only">{t("ai.suggest.loading")}</span>
            <Skeleton className="h-7 w-3/4" />
          </>
        ) : null}
        {state.status === "suggestion" ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              {t("ai.suggest.from", { name: serviceName(t, state.suggestion.service) })}
            </p>
            <p className="text-sm">
              {offered > 0
                ? t("attributes.ai.found", { count: offered })
                : t("attributes.ai.allTaken")}
            </p>
          </div>
        ) : null}
        {state.status === "refused" ? <p className="text-sm">{t("ai.suggest.refused")}</p> : null}
        {state.status === "error" ? (
          <p className="text-sm text-destructive">
            {aiFailureText(t, state.failure, state.service)}
          </p>
        ) : null}
      </div>
      {state.status === "refused" || state.status === "error" ? (
        <AiTryOthers services={state.alternatives} onTryWith={ai.tryWith} />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {offered > 0 ? (
          <Button type="button" size="sm" onClick={onApplyAll}>
            <Check />
            {t("attributes.ai.applyAll")}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={state.status === "loading"}
          onClick={ai.retry}
        >
          {t("ai.suggest.retry")}
        </Button>
        <Button type="button" size="sm" variant="cancel" onClick={ai.close}>
          {t("attributes.ai.close")}
        </Button>
      </div>
    </section>
  )
}

/** Under a field: the value offered, "Uygula" writes it in the form, "Yok say" hides it. */
export function AttributeSuggestion({
  definition,
  value,
  onApply,
  onIgnore,
}: {
  definition: AttributeDefinition
  value: AiAttributeValue
  onApply: () => void
  onIgnore: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/40 px-2.5 py-1.5 text-xs"
      data-slot="ai-attribute-suggestion"
    >
      <Sparkles className="size-3.5 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 break-words">
        {t("attributes.ai.suggested", { value: suggestionText(t, definition, value) })}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 px-2 text-xs"
        aria-label={t("attributes.ai.applyNamed", { label: definition.label })}
        onClick={onApply}
      >
        <Check />
        {t("attributes.ai.apply")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-xs"
        aria-label={t("attributes.ai.ignoreNamed", { label: definition.label })}
        onClick={onIgnore}
      >
        <X />
        {t("attributes.ai.ignore")}
      </Button>
    </div>
  )
}
