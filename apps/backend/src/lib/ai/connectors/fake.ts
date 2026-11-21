import { aiProviderError } from "../errors"
import { ATTRIBUTE_CHOICES_FIELD } from "../facts/product-attributes"
import { PUBLISHED_QUESTIONS_FIELD } from "../product-faq"
import { CATEGORY_CHOICES_FIELD, TAG_CHOICES_FIELD } from "../facts/product-picks"
import { FAKE_SERVICE } from "../registry/services"
import { fakeCampaignAnswer } from "./fake-campaign"
import type { TextConnector, TextRequest, TextResult } from "./types"

/**
 * The fake service's connector (adr/0071 §2): writes from the data block
 * alone, the same every time. No model, no network; every test of the
 * core runs on it. A long-form task (a product's description) gets the
 * same sentence again as paragraphs, up to what its token budget holds,
 * so its gate's word count can pass.
 */

const MAX_FAKE_TEXT = 155
/** An image's text: one an alt text's gate takes. */
const MAX_FAKE_ALT = 120
const FAKE_SEEN = "Açık zemin üzerinde duran tek bir ürün"
/** From this token budget on a task is long-form, and the fake fills it. */
const LONG_FORM_TOKENS = 4_000
/** Characters the fake writes per token of the budget when it fills a long answer. */
const FILL_CHARS_PER_TOKEN = 0.25

/** The sentence as paragraphs, as many whole ones as fit the budget; as it is for a short task. */
function filled(sentence: string, maxTokens: number): string {
  if (maxTokens < LONG_FORM_TOKENS) {
    return sentence
  }
  const room = Math.floor(maxTokens * FILL_CHARS_PER_TOKEN)
  const count = Math.max(1, Math.floor((room + 2) / (sentence.length + 3)))
  return Array.from({ length: count }, () => `${sentence}.`).join("\n\n")
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The texts of the data block, in its own order; a list gives "label value" each. */
function textsOf(data: string): string[] {
  let block: unknown
  try {
    block = JSON.parse(data)
  } catch {
    return []
  }
  const fields = isRecord(block) && isRecord(block["data"]) ? block["data"] : {}
  return Object.values(fields).flatMap((value): string[] => {
    if (typeof value === "string") {
      return [value]
    }
    if (!Array.isArray(value)) {
      return []
    }
    return value.flatMap((each: unknown) =>
      isRecord(each) && typeof each["label"] === "string" && typeof each["value"] === "string"
        ? [`${each["label"]} ${each["value"]}`]
        : []
    )
  })
}

/** A list field's first codes in the data block (a pick task's choices); none when it has no such list. */
function codesOf(data: string, field: string, count: number): string[] | null {
  try {
    const block = JSON.parse(data) as unknown
    const fields = isRecord(block) && isRecord(block["data"]) ? block["data"] : {}
    const list = fields[field]
    return Array.isArray(list)
      ? list
          .slice(0, count)
          .flatMap((each: unknown) =>
            isRecord(each) && typeof each["label"] === "string" ? [each["label"]] : []
          )
      : null
  } catch {
    return null
  }
}

/** A list field's items in the data block (`{label, value}`); null when it has no such list. */
function itemsOf(data: string, field: string): { label: string; value: string }[] | null {
  try {
    const block = JSON.parse(data) as unknown
    const fields = isRecord(block) && isRecord(block["data"]) ? block["data"] : {}
    const list = fields[field]
    return Array.isArray(list)
      ? list.flatMap((each: unknown) =>
          isRecord(each) && typeof each["label"] === "string" && typeof each["value"] === "string"
            ? [{ label: each["label"], value: each["value"] }]
            : []
        )
      : null
  } catch {
    return null
  }
}

/**
 * A value for an attribute as its line describes it (facts/product-card.ts
 * `attributeLine`: "Ad · tür · birim: … · seçenekler: değer = ad; …"):
 * the first option, a number, yes, or a short text.
 */
function fakeValue(line: string): unknown {
  const parts = line.split(" · ")
  const kind = parts[1] ?? ""
  const first = /seçenekler: ([^=;]+) =/.exec(line)?.[1]?.trim()
  if (kind.startsWith("tek seçim")) {
    return first ?? null
  }
  if (kind.startsWith("çoklu seçim")) {
    return first ? [first] : null
  }
  if (kind === "sayı") {
    return 1
  }
  if (kind.startsWith("evet/hayır")) {
    return true
  }
  return "örnek"
}

/** The product's name in the data block, or a stand-in. */
function nameOf(data: string): string {
  try {
    const block = JSON.parse(data) as unknown
    const fields = isRecord(block) && isRecord(block["data"]) ? block["data"] : {}
    return typeof fields["name"] === "string" ? fields["name"].slice(0, 200) : "Bu ürün"
  } catch {
    return "Bu ürün"
  }
}

/** A FAQ draft: three questions, each answered with the product's name, the same every time. */
function fakeFaq(data: string): string {
  const name = nameOf(data)
  return JSON.stringify({
    items: [
      {
        q: "Bu ürün ne için kullanılır?",
        a: `${name}, ürün sayfasında anlatılan kullanım için tasarlanmıştır.`,
      },
      {
        q: "Ürünün öne çıkan özellikleri nelerdir?",
        a: `${name} için özellikler ürün açıklamasında yer alır.`,
      },
      { q: "Hangi seçenekleri var?", a: `${name} için seçenekler ürün sayfasında listelenir.` },
    ],
  })
}

/** A structured task's one JSON object: picks from the named list, attribute values, a FAQ, or a product card. */
function structuredAnswer(data: string): string {
  const attributes = itemsOf(data, ATTRIBUTE_CHOICES_FIELD)
  if (attributes !== null) {
    return JSON.stringify(
      Object.fromEntries(attributes.map((each) => [each.label, fakeValue(each.value)]))
    )
  }
  if (itemsOf(data, PUBLISHED_QUESTIONS_FIELD) !== null) {
    return fakeFaq(data)
  }
  const tags = codesOf(data, TAG_CHOICES_FIELD, 2)
  if (tags !== null) {
    return JSON.stringify({ existing: tags, new: tags.length === 0 ? ["örnek etiket"] : [] })
  }
  const categories = codesOf(data, CATEGORY_CHOICES_FIELD, 1)
  if (categories !== null) {
    return JSON.stringify({ categories })
  }
  const campaign = fakeCampaignAnswer(data)
  if (campaign !== null) {
    return campaign
  }
  return JSON.stringify({
    title: FAKE_SEEN,
    short_description: `${FAKE_SEEN}, sade bir tasarımla.`,
    category: null,
    attributes: {},
  })
}

// A rough count, the same every time: four characters a token
const tokens = (text: string) => Math.ceil(text.length / 4)

export const fakeTextConnector: TextConnector = {
  complete(request: TextRequest): Promise<TextResult> {
    if (request.signal?.aborted) {
      return Promise.reject(
        aiProviderError({ service: FAKE_SERVICE.id, key: "ai.timeout", code: "aborted" })
      )
    }
    // A structured task (a product card, a pick) gets one JSON object, the same every time
    if (request.json === true) {
      const text = structuredAnswer(request.data)
      return Promise.resolve({
        text,
        usage: {
          inputTokens: tokens(request.system) + tokens(request.data),
          outputTokens: tokens(text),
        },
      })
    }
    // An image with no text beside it still gets a description, as a real model would write
    const seen = request.images?.length && textsOf(request.data).length === 0 ? [FAKE_SEEN] : []
    const sentence = Array.from([...textsOf(request.data), ...seen].join(", "))
      .slice(0, request.images?.length ? MAX_FAKE_ALT : MAX_FAKE_TEXT)
      .join("")
      .trim()
    if (sentence === "") {
      return Promise.reject(
        aiProviderError({
          service: FAKE_SERVICE.id,
          key: "ai.provider_response_invalid",
          code: "empty_content",
        })
      )
    }
    const text = filled(sentence, request.maxTokens)
    return Promise.resolve({
      text,
      usage: {
        inputTokens: tokens(request.system) + tokens(request.data),
        outputTokens: tokens(text),
      },
    })
  },
}
