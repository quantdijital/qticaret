import { useEffect, useLayoutEffect, useRef } from "react"
import type { AiEntity } from "@/features/ai/api/suggestions"
import type { AdvisorKind, AdvisorAiField } from "@/features/seo/api/advisor"

/**
 * From an advisor finding's AI button to the form that owns the field
 * (docs/22 "Aşama 3"): "Kullan" on the finding hands the text here, the
 * page's form for that record takes it as the person's own change, and
 * its Save writes it, or leaving drops it (adr/0005). A form not drawn
 * yet (its data still loading) takes it when it is.
 */

type Receiver = (text: string) => void

const keyOf = (type: string, id: string, field: AdvisorAiField) => `${type}:${id}:${field}`

const receivers = new Map<string, Receiver>()
const pending = new Map<string, string>()

/** The fields a page's form takes today: the SEO card's two (a description's editor has none yet). */
export const FILLABLE_FIELDS: readonly AdvisorAiField[] = ["seo_title", "seo_description"]

/** The records the AI core reads (`AI_ENTITY_TYPES`); a blog post, a brand… have no button. */
export const aiEntityOf = (kind: AdvisorKind, id: string): AiEntity | null =>
  kind === "product" || kind === "category" || kind === "page" ? { type: kind, id } : null

/** Hands an accepted suggestion to the record's form; kept for it until it is drawn. */
export function sendAiFill(type: string, id: string, field: AdvisorAiField, text: string): void {
  const key = keyOf(type, id, field)
  const receiver = receivers.get(key)
  if (receiver) {
    receiver(text)
  } else {
    pending.set(key, text)
  }
}

/** Drops what no form took: the page was left first. */
export function clearAiFills(type: string, id: string): void {
  const prefix = `${type}:${id}:`
  for (const key of pending.keys()) {
    if (key.startsWith(prefix)) {
      pending.delete(key)
    }
  }
}

/** A form's side: takes the suggestions sent for this record's field. */
export function useAiFill(
  type: string,
  id: string,
  field: AdvisorAiField,
  receive: (text: string) => void
): void {
  const latest = useRef(receive)
  useLayoutEffect(() => {
    latest.current = receive
  })
  useEffect(() => {
    const key = keyOf(type, id, field)
    const receiver: Receiver = (text) => {
      latest.current(text)
    }
    receivers.set(key, receiver)
    const waiting = pending.get(key)
    if (waiting !== undefined) {
      pending.delete(key)
      receiver(waiting)
    }
    return () => {
      if (receivers.get(key) === receiver) {
        receivers.delete(key)
      }
    }
  }, [type, id, field])
}
