import { aiProviderError } from "../errors"
import { FAKE_SERVICE } from "../registry/services"
import type { TextConnector, TextRequest, TextResult } from "./types"

/**
 * The fake service's connector (adr/0071 §2): writes from the data block
 * alone, the same every time. No model, no network; every test of the
 * core runs on it. Follows the fake of `lib/content-drafts/provider.ts`.
 */

const MAX_FAKE_TEXT = 155

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
    const seen = request.images?.length ? [`${String(request.images.length)} görsel`] : []
    const text = Array.from([...textsOf(request.data), ...seen].join(", "))
      .slice(0, MAX_FAKE_TEXT)
      .join("")
      .trim()
    if (text === "") {
      return Promise.reject(
        aiProviderError({
          service: FAKE_SERVICE.id,
          key: "ai.provider_response_invalid",
          code: "empty_content",
        })
      )
    }
    return Promise.resolve({
      text,
      usage: {
        inputTokens: tokens(request.system) + tokens(request.data),
        outputTokens: tokens(text),
      },
    })
  },
}
