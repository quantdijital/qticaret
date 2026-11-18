import { aiProviderError } from "../errors"
import { FAKE_SERVICE } from "../registry/services"
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

// A rough count, the same every time: four characters a token
const tokens = (text: string) => Math.ceil(text.length / 4)

export const fakeTextConnector: TextConnector = {
  complete(request: TextRequest): Promise<TextResult> {
    if (request.signal?.aborted) {
      return Promise.reject(
        aiProviderError({ service: FAKE_SERVICE.id, key: "ai.timeout", code: "aborted" })
      )
    }
    // A structured task (a product card) gets one JSON object, the same every time
    if (request.json === true) {
      const text = JSON.stringify({
        title: FAKE_SEEN,
        short_description: `${FAKE_SEEN}, sade bir tasarımla.`,
        category: null,
        attributes: {},
      })
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
