import { useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { useRef, useState } from "react"
import { aiServicesQuery } from "@/features/ai/api/ai"
import { acceptSuggestion } from "@/features/ai/api/suggestions"
import type { AiAttributeValue } from "@/features/ai/attribute-values"
import { hintClosed } from "@/features/ai/hint-state"
import { useAiSuggestion } from "@/features/ai/use-ai-suggestion"
import type { AttributeDefinition } from "@/features/attributes/types"

const TASK = "product_attributes"

/** A suggested value in the field's own words: an option's label, yes or no, a number with its unit. */
export function suggestionText(
  t: TFunction,
  definition: AttributeDefinition,
  value: AiAttributeValue
): string {
  const label = (option: string) =>
    (definition.options ?? []).find((each) => each.value === option)?.label ?? option
  if (Array.isArray(value)) {
    return value.map(label).join(", ")
  }
  if (typeof value === "boolean") {
    return value ? t("attributes.ai.yes") : t("attributes.ai.no")
  }
  if (typeof value === "number") {
    return definition.unit ? `${String(value)} ${definition.unit}` : String(value)
  }
  return definition.type === "select" ? label(value) : value
}

/**
 * Values for a product's empty attributes (adr/0074 §5 madde 3): one
 * button asks, each value is offered under its field, "Uygula" writes it
 * in the form (one or all), the card's Save stores it. Only fields still
 * empty in the form are offered; the decision is recorded once, at the
 * first value taken, and closing with none taken dismisses it. The
 * backend reads the saved product (its template and empty values) and,
 * where the service sees, its first picture.
 */
export function useAttributesAi(productId: string) {
  const services = useQuery(aiServicesQuery())
  const view = services.data?.tasks.find((each) => each.id === TASK)
  const usable = view?.usable ?? []
  const [picked, setPicked] = useState<string | null>(null)
  const remembered = view?.preference && usable.includes(view.preference) ? view.preference : null
  const service = picked && usable.includes(picked) ? picked : (remembered ?? usable[0] ?? "")
  const [open, setOpen] = useState(false)
  const [hintGone, setHintGone] = useState(hintClosed)
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(new Set())
  const suggestion = useAiSuggestion(TASK, { type: "product", id: productId })
  const decided = useRef<string | null>(null)
  const { state } = suggestion
  const values = state.status === "suggestion" ? (state.suggestion.attributes?.values ?? {}) : {}

  const ask = (next: { service?: string } = {}) => {
    decided.current = null
    setIgnored(new Set())
    void suggestion.request(usable.length > 1 ? { service: next.service ?? service } : {})
  }

  return {
    state,
    usable,
    service,
    open,
    /** The role may ask, and a service is usable or its connect hint not closed. */
    shown: view?.allowed === true && !(usable.length === 0 && hintGone),
    start: () => {
      setOpen(true)
      if (usable.length > 0) {
        ask()
      }
    },
    retry: () => {
      ask()
    },
    pick: (id: string) => {
      setPicked(id)
      ask({ service: id })
    },
    tryWith: (id: string) => {
      if (usable.includes(id)) {
        setPicked(id)
      }
      void suggestion.tryWith(id)
    },
    close: () => {
      setOpen(false)
      if (state.status === "suggestion" && decided.current === state.suggestion.id) {
        suggestion.reset()
      } else {
        suggestion.dismiss()
      }
    },
    hideHint: () => {
      setOpen(false)
      setHintGone(true)
    },
    /** The value offered for a field, unless it was ignored. */
    valueFor: (key: string): AiAttributeValue | undefined =>
      ignored.has(key) || !Object.hasOwn(values, key) ? undefined : values[key],
    ignore: (key: string) => {
      setIgnored((was) => new Set([...was, key]))
    },
    /** Records the decision once, at the first value taken; the form already has it. */
    taken: () => {
      if (state.status === "suggestion" && decided.current !== state.suggestion.id) {
        decided.current = state.suggestion.id
        void acceptSuggestion(state.suggestion.id).catch(() => undefined)
      }
    },
  }
}

export type AttributesAi = ReturnType<typeof useAttributesAi>
