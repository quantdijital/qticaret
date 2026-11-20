import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useRef, useState } from "react"
import { AI_KEY } from "@/features/ai/api/ai"
import {
  acceptSuggestion,
  dismissSuggestion,
  requestSuggestion,
} from "@/features/ai/api/suggestions"
import type { AiEntity, AiFailure, AiSuggestion } from "@/features/ai/api/suggestions"

export type AiSuggestionState =
  | { status: "idle" }
  | { status: "loading"; service: string | null }
  | { status: "suggestion"; suggestion: AiSuggestion }
  | { status: "refused"; service: string | null; alternatives: string[] }
  | { status: "error"; failure: unknown; service: string | null; alternatives: string[] }

/** What the next request asks for: the picked service (several usable) and a ready option. */
export interface AiAsk {
  service?: string | undefined
  option?: string | undefined
  /** The record, when it is known only at the ask (a photo just uploaded); left out: the hook's. */
  entity?: AiEntity | undefined
  /** A product card's attribute template (`product_from_photo`). */
  templateId?: string | undefined
}

// The services the backend no longer offers for the task: the picker and the hint read them again (§12)
const STALE_SERVICES = new Set(["ai.no_service", "ai.service_unavailable"])

const asFailure = (error: unknown): Partial<AiFailure> =>
  typeof error === "object" && error !== null ? error : {}

/**
 * A suggestion's life on one field (adr/0071 §4, §13): idle → loading →
 * suggestion | refused | error. `retry()` asks again the same way;
 * `tryWith(service)` asks another service, only when the person chose it
 * (never on its own). `accept()` records the decision and returns the
 * text for the form, which saves it as its own change; `dismiss()` closes.
 */
export function useAiSuggestion(task: string, entity: AiEntity) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AiSuggestionState>({ status: "idle" })
  const last = useRef<AiAsk>({})
  // A later request wins: an older answer arriving after it is dropped
  const turn = useRef(0)

  const request = useCallback(
    async (ask: AiAsk = {}) => {
      last.current = ask
      const mine = ++turn.current
      setState({ status: "loading", service: ask.service ?? null })
      try {
        const suggestion = await requestSuggestion({ task, ...ask, entity: ask.entity ?? entity })
        if (mine === turn.current) {
          setState({ status: "suggestion", suggestion })
        }
      } catch (error) {
        if (mine !== turn.current) {
          return
        }
        const failure = asFailure(error)
        const service = failure.service ?? ask.service ?? null
        const alternatives = failure.alternatives ?? []
        if (failure.code === "ai.suggestion_refused") {
          setState({ status: "refused", service, alternatives })
          return
        }
        if (typeof failure.code === "string" && STALE_SERVICES.has(failure.code)) {
          void queryClient.invalidateQueries({ queryKey: AI_KEY })
        }
        setState({ status: "error", failure: error, service, alternatives })
      }
    },
    // The record is its type and id; a new object each render is the same record
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task, entity.type, entity.id, queryClient]
  )

  const retry = useCallback(() => request(last.current), [request])

  const tryWith = useCallback((service: string) => request({ ...last.current, service }), [request])

  const reset = useCallback(() => {
    turn.current++
    setState({ status: "idle" })
  }, [])

  /**
   * The text to put in the form: the candidate picked (the first when none
   * is named); the decision and the pick are recorded, the record is not written.
   */
  const accept = useCallback(
    async (candidate?: string): Promise<string | null> => {
      if (state.status !== "suggestion") {
        return null
      }
      const { id, text, candidates } = state.suggestion
      const at = candidate === undefined ? -1 : candidates.indexOf(candidate)
      const picked = at === -1 ? text : candidate
      reset()
      // The text is already here: a decision that could not be recorded does not hold up the form
      const accepted = await acceptSuggestion(id, at === -1 ? undefined : at).catch(() => null)
      return accepted ?? picked ?? text
    },
    [state, reset]
  )

  const dismiss = useCallback(() => {
    if (state.status === "suggestion") {
      void dismissSuggestion(state.suggestion.id).catch(() => undefined)
    }
    reset()
  }, [state, reset])

  return { state, request, retry, tryWith, accept, dismiss }
}
