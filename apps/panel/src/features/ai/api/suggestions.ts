/**
 * The AI core's suggestion calls (adr/0071 §11), as the backend answers
 * them (`api/admin/ai/suggestions*`). Not through the SDK: its error keeps
 * only the sentence, and the panel needs the key (`code`) and the other
 * services to try (`alternatives`, §4) beside it. Nothing here writes the
 * record: accepting returns the text, the form saves it.
 */

import { readAttributeSuggestions } from "@/features/ai/attribute-values"
import type { AiAttributeSuggestions } from "@/features/ai/attribute-values"
import { readFaq } from "@/features/ai/faq"
import type { AiFaq, AiFaqItem } from "@/features/ai/faq"
import { readPicks } from "@/features/ai/picks"
import type { AiPicks } from "@/features/ai/picks"
import { readProductCard } from "@/features/ai/product-card"
import type { ProductCard } from "@/features/ai/product-card"

/** The record a suggestion is for; the backend reads its public facts itself. */
export interface AiEntity {
  /** The backend's `AI_ENTITY_TYPES`: a content page is `page`, a blog post is not one; `media` an image. */
  type: "product" | "category" | "collection" | "brand" | "page" | "media" | "review" | "question"
  id: string
}

/** A suggestion the gate let through (201). */
export interface AiSuggestion {
  id: string
  task: string
  service: string
  status: "draft"
  /** The first candidate (the strongest), or the one text of a task with no candidates. */
  text: string
  /**
   * Every candidate the gate let through, the strongest first (adr/0074 §4):
   * a short search text comes as several; otherwise `[text]`.
   */
  candidates: string[]
  alternatives: string[]
  /** A product card from a photo (`product_from_photo`): its fields; none for a text. */
  card?: ProductCard | null
  /** A product's tags or categories (`product_tags`, `product_category`): records from the shop's lists. */
  picks?: AiPicks | null
  /** A product's empty attributes (`product_attributes`): a value by attribute key. */
  attributes?: AiAttributeSuggestions | null
  /** A product's FAQ draft (`product_faq`): questions with their answers. */
  faq?: AiFaq | null
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

/** A POST to the AI core's routes; a failure keeps the key and the services to try (`AiFailure`). */
export async function postAi(path: string, body: unknown): Promise<unknown> {
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

/** The candidates as texts, repeats dropped; none given (an older backend): the text alone. */
function candidatesOf(value: unknown, text: string): string[] {
  const texts = Array.isArray(value)
    ? value.filter((each): each is string => typeof each === "string" && each.trim() !== "")
    : []
  const unique = [...new Set(texts)]
  return unique.length > 0 ? unique : text === "" ? [] : [text]
}

/** `POST /admin/ai/suggestions`: a suggestion for a record's field, never written to it. */
export async function requestSuggestion(request: AiSuggestionRequest): Promise<AiSuggestion> {
  const data = suggestionOf(
    await postAi("/admin/ai/suggestions", {
      task: request.task,
      entity_type: request.entity.type,
      entity_id: request.entity.id,
      ...(request.service === undefined ? {} : { service: request.service }),
      ...(request.option === undefined ? {} : { option: request.option }),
      ...(request.templateId === undefined ? {} : { template_id: request.templateId }),
    })
  )
  const text = typeof data["text"] === "string" ? data["text"] : ""
  return {
    id: typeof data["id"] === "string" ? data["id"] : "",
    task: typeof data["task"] === "string" ? data["task"] : request.task,
    service: nameOf(data["service"]) ?? "",
    status: "draft",
    text,
    candidates: candidatesOf(data["candidates"], text),
    alternatives: namesOf(data["alternatives"]),
    ...("card" in data ? { card: readProductCard(data["card"]) } : {}),
    ...("picks" in data ? { picks: readPicks(data["picks"]) } : {}),
    ...("attributes" in data ? { attributes: readAttributeSuggestions(data["attributes"]) } : {}),
    ...("faq" in data ? { faq: readFaq(data["faq"]) } : {}),
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
 * A scene typed once (`image_scene`) goes as `prompt` in place of `option`.
 */
export async function requestImageJob(request: {
  task: string
  mediaIds: string[]
  /** The background, or the scene by its code (a saved scene's id). */
  option?: string | undefined
  /** A scene typed for this once; the server cleans it and sends it behind its own words. */
  prompt?: string | undefined
  service?: string | undefined
}): Promise<AiImageJob> {
  const data = (await postAi("/admin/ai/suggestions", {
    task: request.task,
    entity_type: "media",
    entity_ids: request.mediaIds,
    ...(request.prompt === undefined ? { option: request.option } : { prompt: request.prompt }),
    ...(request.service === undefined ? {} : { service: request.service }),
  })) as Record<string, unknown> | null
  return {
    job_id: typeof data?.["job_id"] === "string" ? data["job_id"] : "",
    service: nameOf(data?.["service"]) ?? "",
  }
}

const decisionPath = (id: string, decision: "accept" | "dismiss"): string =>
  `/admin/ai/suggestions/${encodeURIComponent(id)}/${decision}`

/**
 * `POST …/accept`: records the decision and the candidate taken (by its
 * place among those offered, adr/0074 §4; the first when left out) and
 * returns that candidate's text; the record is not touched.
 */
export async function acceptSuggestion(
  id: string,
  candidateIndex?: number
): Promise<string | null> {
  const body = candidateIndex === undefined ? {} : { candidate_index: candidateIndex }
  const text = suggestionOf(await postAi(decisionPath(id, "accept"), body))["text"]
  return typeof text === "string" ? text : null
}

/**
 * `POST …/faq`: a FAQ draft's items a person kept, as they edited them, added
 * as the shop's own questions on the product's page; the server gates each
 * again (400 `ai.faq_item_invalid`) and records the decision. Unlike the other
 * decisions this one writes: the questions are published at once.
 */
export async function addFaqItems(id: string, items: readonly AiFaqItem[]): Promise<number> {
  const data = suggestionOf(
    await postAi(`/admin/ai/suggestions/${encodeURIComponent(id)}/faq`, {
      items: items.map((item) => ({ q: item.question, a: item.answer })),
    })
  )
  return Array.isArray(data["question_ids"]) ? data["question_ids"].length : 0
}

/** `POST …/dismiss`: the suggestion was not used. */
export async function dismissSuggestion(id: string): Promise<void> {
  await postAi(decisionPath(id, "dismiss"), {})
}
