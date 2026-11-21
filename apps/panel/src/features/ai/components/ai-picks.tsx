import { useQuery } from "@tanstack/react-query"
import { Check, Plus, Sparkles } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@qticaret/admin-ui/ui/badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { aiServicesQuery } from "@/features/ai/api/ai"
import { acceptSuggestion } from "@/features/ai/api/suggestions"
import type { AiEntity } from "@/features/ai/api/suggestions"
import { AiConnectHint } from "@/features/ai/components/ai-connect-hint"
import { AiServicePicker } from "@/features/ai/components/ai-service-picker"
import { AiTryOthers } from "@/features/ai/components/ai-try-others"
import { aiFailureText, serviceName } from "@/features/ai/failure-text"
import { hintClosed } from "@/features/ai/hint-state"
import { useAiSuggestion } from "@/features/ai/use-ai-suggestion"

/** One chip clicked: a record of the shop's list by id, or a new tag by its name. */
export type AiPick = { kind: "record"; id: string; name: string } | { kind: "new"; name: string }

export interface AiPicksProps {
  /** `product_tags` or `product_category`. */
  task: string
  entity: AiEntity
  /** The button's name and the panel's label ("Etiket öner"). */
  label: string
  /** Adds the pick to the form; the form's Save writes it, or not. */
  onPick: (pick: AiPick) => void
  /** Already in the form (record ids, lower-cased new names): drawn as added. */
  has: (pick: AiPick) => boolean
}

/**
 * Picks from the shop's own lists beside a field (adr/0074 §5 madde 2):
 * one click asks, the suggestions come as chips, each click adds one to
 * the form. A new tag is marked "yeni" and created only when the form is
 * saved. The decision is recorded once, at the first chip taken; closing
 * with none taken dismisses it. A role the task does not allow draws
 * nothing; no service draws the connect hint in the same place.
 */
export function AiPicks({ task, entity, label, onPick, has }: AiPicksProps) {
  const { t } = useTranslation()
  const services = useQuery(aiServicesQuery())
  const view = services.data?.tasks.find((each) => each.id === task)
  const usable = view?.usable ?? []
  const [picked, setPicked] = useState<string | null>(null)
  const remembered = view?.preference && usable.includes(view.preference) ? view.preference : null
  const service = picked && usable.includes(picked) ? picked : (remembered ?? usable[0] ?? "")
  const [open, setOpen] = useState(false)
  const [hintGone, setHintGone] = useState(hintClosed)
  const suggestion = useAiSuggestion(task, entity)
  // The suggestion whose decision was sent: closing it then sends no dismissal
  const decided = useRef<string | null>(null)

  if (!view?.allowed || (usable.length === 0 && hintGone)) {
    return null
  }

  const ask = (next: { service?: string } = {}) => {
    void suggestion.request(usable.length > 1 ? { service: next.service ?? service } : {})
  }

  const close = () => {
    setOpen(false)
    const { state } = suggestion
    if (state.status === "suggestion" && decided.current === state.suggestion.id) {
      suggestion.reset()
    } else {
      suggestion.dismiss()
    }
  }

  const take = (pick: AiPick) => {
    onPick(pick)
    const { state } = suggestion
    if (state.status === "suggestion" && decided.current !== state.suggestion.id) {
      decided.current = state.suggestion.id
      // The form has the pick already: a decision that could not be recorded holds nothing up
      void acceptSuggestion(state.suggestion.id).catch(() => undefined)
    }
  }

  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 self-start text-xs"
      aria-label={label}
      aria-expanded={open}
      onClick={() => {
        if (open) {
          close()
          return
        }
        setOpen(true)
        if (usable.length > 0) {
          ask()
        }
      }}
    >
      <Sparkles />
      {t("ai.picks.button")}
    </Button>
  )

  if (!open) {
    return button
  }
  if (usable.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {button}
        <div className="rounded-md border p-3">
          <AiConnectHint
            onClose={() => {
              setOpen(false)
              setHintGone(true)
            }}
          />
        </div>
      </div>
    )
  }

  const { state } = suggestion
  const picks = state.status === "suggestion" ? state.suggestion.picks : null
  const chips: AiPick[] = [
    ...(picks?.picked ?? []).map((each) => ({ kind: "record" as const, ...each })),
    ...(picks?.new_tags ?? []).map((name) => ({ kind: "new" as const, name })),
  ]
  return (
    <div className="flex flex-col gap-2">
      {button}
      <section
        aria-label={label}
        className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3"
        data-slot="ai-picks"
      >
        <AiServicePicker
          services={usable}
          value={service}
          disabled={state.status === "loading"}
          onChange={(id) => {
            setPicked(id)
            ask({ service: id })
          }}
        />
        <div role="status" aria-live="polite" aria-busy={state.status === "loading"}>
          {state.status === "loading" || state.status === "idle" ? (
            <>
              <span className="sr-only">{t("ai.suggest.loading")}</span>
              <Skeleton className="h-7 w-3/4" />
            </>
          ) : null}
          {state.status === "suggestion" ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {t("ai.suggest.from", { name: serviceName(t, state.suggestion.service) })}
              </p>
              <ul className="flex flex-wrap gap-2" aria-label={t("ai.suggest.choices")}>
                {chips.map((pick) => {
                  const added = has(pick)
                  const name =
                    pick.kind === "new" ? t("ai.picks.newNamed", { name: pick.name }) : pick.name
                  return (
                    <li key={`${pick.kind}:${pick.kind === "record" ? pick.id : pick.name}`}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={added}
                        aria-label={
                          added ? t("ai.picks.added", { name }) : t("ai.picks.add", { name })
                        }
                        onClick={() => {
                          take(pick)
                        }}
                      >
                        {added ? <Check /> : <Plus />}
                        {pick.name}
                        {pick.kind === "new" ? (
                          <Badge variant="secondary" className="ml-1 px-1 text-[10px]">
                            {t("ai.picks.new")}
                          </Badge>
                        ) : null}
                      </Button>
                    </li>
                  )
                })}
              </ul>
              <p className="text-xs text-muted-foreground">{t("ai.picks.note")}</p>
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
          <AiTryOthers
            services={state.alternatives}
            onTryWith={(id) => {
              if (usable.includes(id)) {
                setPicked(id)
              }
              void suggestion.tryWith(id)
            }}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={state.status === "loading"}
            onClick={() => {
              decided.current = null
              ask()
            }}
          >
            {t("ai.suggest.retry")}
          </Button>
          <Button type="button" size="sm" variant="cancel" onClick={close}>
            {t("ai.picks.close")}
          </Button>
        </div>
      </section>
    </div>
  )
}
