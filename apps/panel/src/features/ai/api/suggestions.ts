/**
 * The AI core's suggestion calls (adr/0071 §11), as the backend answers
 * them (`api/admin/ai/suggestions*`). Not through the SDK: its error keeps
 * only the sentence, and the panel needs the key (`code`) and the other
 * services to try (`alternatives`, §4) beside it. Nothing here writes the
 * record: accepting returns the text, the form saves it.
 */

import { readProductCard } from "@/features/ai/product-card"
import type { ProductCard } from "@/features/ai/product-card"

/** The record a suggestion is for; the backend reads its public facts itself. */
export interface AiEntity {
  /** The backend's `AI_ENTITY_TYPES`: a content page is `page`, a blog post is not one; `media` an image. */
  type: "product" | "category" | "page" | "media"
  id: string
}

/** A suggestion the gate let through (201). */
export interface AiSuggestion {
  id: string
  task: string
  service: string
  status: "draft"
  text: string
  alternatives: string[]
  /** A product card from a photo (`product_from_photo`): its fields; none for a text. */
  card?: ProductCard | null
}

/** A suggestion turned down by the gate (422) or a failed call (4xx/5xx), with what the panel may show. */
export interface AiFailure extends Error {
  status: number
  /** The backend's key (`ai.provider_busy`); null when the body had none of ours. */
  code: string | null
  /** The service the call went to, when the backend names it. */
  service: string | null
  /** The usable services but the failed one; empty: nothing else to offer. */
  alternatives: string[]
}

export interface AiSuggestionRequest {
  task: string
  entity: AiEntity
  /** Only when several services are usable: the one picked. */
  service?: string | undefined
  /** A ready option of the task (`short`), never free text. */
  option?: string | undefined
  /** A product card's attribute template (`product_from_photo`): its attributes may be filled. */
  templateId?: string | undefined
}

// Our own registry names; anything else from a body is not shown
const NAME = /^[a-z][a-z0-9_-]{0,39}$/
const KEY = /^[a-z_]+(\.[a-z_]+)+$/

const namesOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((each): each is string => typeof each === "string" && NAME.test(each))
    : []

const nameOf = (value: unknown): string | null =>
  typeof value === "string" && NAME.test(value) ? value : null

async function post(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (response.ok) {
    return data
  }
  const said = typeof data?.["message"] === "string" ? data["message"] : response.statusText
  // The dashboard client gets the sentence in `message` and the key in `code` (adr/0021);
  // a refusal answered by the route itself has the key in `message`
  const key = [data?.["code"], data?.["message"]].find(
    (each): each is string => typeof each === "string" && KEY.test(each)
  )
  const failure: AiFailure = Object.assign(new Error(said), {
    status: response.status,
    code: key ?? null,
    service: nameOf(data?.["service"]) ?? nameOf(data?.["provider"]),
    alternatives: namesOf(data?.["alternatives"]),
  })
  throw failure
}

const suggestionOf = (data: unknown): Record<string, unknown> => {
  const suggestion = (data as { suggestion?: unknown } | null)?.suggestion
  return typeof suggestion === "object" && suggestion !== null
    ? (suggestion as Record<string, unknown>)
    : {}
}

/** `POST /admin/ai/suggestions`: a suggestion for a record's field, never written to it. */
export async function requestSuggestion(request: AiSuggestionRequest): Promise<AiSuggestion> {
  const data = suggestionOf(
    await post("/admin/ai/suggestions", {
      task: request.task,
      entity_type: request.entity.type,
      entity_id: request.entity.id,
      ...(request.service === undefined ? {} : { service: request.service }),
      ...(request.option === undefined ? {} : { option: request.option }),
      ...(request.templateId === undefined ? {} : { template_id: request.templateId }),
    })
  )
  return {
    id: typeof data["id"] === "string" ? data["id"] : "",
    task: typeof data["task"] === "string" ? data["task"] : request.task,
    service: nameOf(data["service"]) ?? "",
    status: "draft",
    text: typeof data["text"] === "string" ? data["text"] : "",
    alternatives: namesOf(data["alternatives"]),
    ...("card" in data ? { card: readProductCard(data["card"]) } : {}),
  }
}

/** A picture job queued (202): its id and the service it went to. */
export interface AiImageJob {
  job_id: string
  service: string
}

/**
 * `POST /admin/ai/suggestions` with `entity_ids` (Aşama 4): an image edit
 * as a background job (202). Its result is a new picture beside the
 * original and a suggestion to decide; nothing is written to the original.
 */
export async function requestImageJob(request: {
  task: string
  mediaIds: string[]
  option: string
  service?: string | undefined
}): Promise<AiImageJob> {
  const data = (await post("/admin/ai/suggestions", {
    task: request.task,
    entity_type: "media",
    entity_ids: request.mediaIds,
    option: request.option,
    ...(request.service === undefined ? {} : { service: request.service }),
  })) as Record<string, unknown> | null
  return {
    job_id: typeof data?.["job_id"] === "string" ? data["job_id"] : "",
    service: nameOf(data?.["service"]) ?? "",
  }
}

const decisionPath = (id: string, decision: "accept" | "dismiss"): string =>
  `/admin/ai/suggestions/${encodeURIComponent(id)}/${decision}`

/** `POST …/accept`: records the decision and returns the text; the record is not touched. */
export async function acceptSuggestion(id: string): Promise<string | null> {
  const text = suggestionOf(await post(decisionPath(id, "accept"), {}))["text"]
  return typeof text === "string" ? text : null
}

/** `POST …/dismiss`: the suggestion was not used. */
export async function dismissSuggestion(id: string): Promise<void> {
  await post(decisionPath(id, "dismiss"), {})
}
