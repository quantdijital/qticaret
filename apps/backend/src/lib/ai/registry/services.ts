import type { AiErrorKey } from "../errors"
import type { AiCapability } from "./capabilities"

/**
 * The AI services a shop can connect (adr/0071 §2). A fixed registry: no
 * user, setting or service answer can name a base address (§9 SSRF). A
 * capability is listed only after it was checked against the service's
 * own current documentation; the date and the pages stand above each
 * record. What could not be verified is not here.
 */

export type AiFunding = "own_key" | "platform_credit"

/** Micro units (a millionth of the currency) per million tokens; an estimate, never an invoice. */
export interface AiUnitPrice {
  currency: "USD"
  inputPerMillionTokens: number
  outputPerMillionTokens: number
}

export interface OpenAiCompatibleTarget {
  connector: "openai-compatible"
  model: string
  /** `https`, on one of the service's `hosts`. */
  baseUrl: string
  /** Appended to `baseUrl` as it is. */
  path: string
  /** The body field that caps the output; null where the documentation names none. */
  maxTokensField: "max_tokens" | "max_completion_tokens" | null
  /** `response_format: { type: "json_object" }` is documented for this endpoint. */
  jsonMode: boolean
  /** Fixed body fields the service documents (thinking off, reasoning apart from the text). */
  body: Readonly<Record<string, unknown>>
}

export interface FakeTarget {
  connector: "fake"
  model: string
}

/** What an `image_edit` service is asked to do with the background (`image_background`). */
export const IMAGE_BACKGROUNDS = ["transparent", "white"] as const
export type ImageBackground = (typeof IMAGE_BACKGROUNDS)[number]

/** An image editing endpoint (Aşama 4): its full address, fixed here. */
export interface ImageEditTarget {
  connector: "photoroom" | "gemini-image"
  model: string
  /** `https`, on one of the service's `hosts`; no query. */
  url: string
  /** The backgrounds this endpoint is documented to make. */
  backgrounds: readonly ImageBackground[]
}

export interface FakeImageTarget {
  connector: "fake-image"
  model: string
  backgrounds: readonly ImageBackground[]
}

export type AiTarget = OpenAiCompatibleTarget | FakeTarget | ImageEditTarget | FakeImageTarget

export interface AiService {
  id: string
  /** Its key in `CREDENTIAL_PROVIDERS` (modules/integration-credentials). */
  credentialProvider: string
  funding: AiFunding
  /** The only hosts a call may go to. */
  hosts: readonly string[]
  /** The only hosts a result file (image, video) may be downloaded from. */
  downloadHosts: readonly string[]
  capabilities: Readonly<Partial<Record<AiCapability, AiTarget>>>
  unitPrices: Readonly<Partial<Record<AiCapability, AiUnitPrice>>>
  /** Where the data goes and whether it trains models; shown when connecting (panel i18n key). */
  dataNoteKey: string
  /** Error codes the service writes in the body (`base_resp.status_code`), by what they mean. */
  bodyErrors?: Readonly<Record<number, AiErrorKey>>
}

/*
 * DeepSeek. Verified 2026-11-17 against:
 *   https://api-docs.deepseek.com/ (base address, Bearer header, model names)
 *   https://api-docs.deepseek.com/api/create-chat-completion (path, `max_tokens`,
 *     `response_format` text | json_object, `thinking`, usage fields, finish reasons)
 *   https://api-docs.deepseek.com/guides/json_mode
 *   https://api-docs.deepseek.com/quick_start/error_codes (401 wrong key, 402 no balance,
 *     429 rate limit, 500 server error, 503 overloaded)
 *   https://api-docs.deepseek.com/quick_start/pricing/ (peak prices are used)
 *   https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html (processed and
 *     stored in the People's Republic of China; training is a listed purpose)
 * Not verified: the error body's shape (only the status is read); image input per
 * model (the reference mentions image parts, no model page confirms it): no `vision`.
 */
const DEEPSEEK: AiService = {
  id: "deepseek",
  credentialProvider: "deepseek",
  funding: "own_key",
  hosts: ["api.deepseek.com"],
  downloadHosts: [],
  capabilities: {
    text: {
      connector: "openai-compatible",
      model: "deepseek-flash",
      baseUrl: "https://api.deepseek.com",
      path: "/chat/completions",
      maxTokensField: "max_tokens",
      jsonMode: true,
      // Thinking is on unless turned off; a title needs none
      body: { thinking: { type: "disabled" } },
    },
  },
  unitPrices: {
    text: { currency: "USD", inputPerMillionTokens: 300_000, outputPerMillionTokens: 1_200_000 },
  },
  dataNoteKey: "ai.data_note.deepseek",
}

/*
 * MiniMax (international platform only). Verified 2026-11-17 against:
 *   https://platform.minimax.io/docs/api-reference/text-chat-openai (POST
 *     https://api.minimax.io/v1/chat/completions, Bearer key, models, `max_completion_tokens`,
 *     `base_resp.status_code` values)
 *   https://platform.minimax.io/docs/api-reference/text-openai-api (`reasoning_split`,
 *     `reasoning_effort`, ignored parameters)
 *   https://platform.minimax.io/docs/api-reference/errorcode
 *   https://platform.minimax.io/docs/pricing/overview
 * Not verified: a JSON output mode (`response_format` is not documented): off. Which
 * HTTP status goes with a `base_resp` code: both are read. The China address (the pages
 * disagree): not listed. Data processing place and training terms (the platform's
 * privacy policy could not be read): the note says so. Image input is documented but
 * `vision` waits for its connector (Aşama 5).
 */
const MINIMAX: AiService = {
  id: "minimax",
  credentialProvider: "minimax",
  funding: "own_key",
  hosts: ["api.minimax.io"],
  downloadHosts: [],
  capabilities: {
    text: {
      connector: "openai-compatible",
      model: "MiniMax-M3.1-Flash",
      baseUrl: "https://api.minimax.io/v1",
      path: "/chat/completions",
      maxTokensField: "max_completion_tokens",
      jsonMode: false,
      // The model always thinks; its thinking goes to its own field, not into the text
      body: { reasoning_split: true, reasoning_effort: "low" },
    },
  },
  unitPrices: {
    text: { currency: "USD", inputPerMillionTokens: 150_000, outputPerMillionTokens: 600_000 },
  },
  dataNoteKey: "ai.data_note.minimax",
  bodyErrors: {
    1000: "ai.provider_unavailable",
    1001: "ai.timeout",
    1002: "ai.provider_busy",
    1004: "ai.key_rejected",
    1008: "ai.provider_balance",
    1013: "ai.provider_unavailable",
    1024: "ai.provider_unavailable",
    1026: "ai.content_blocked",
    1027: "ai.content_blocked",
    1033: "ai.provider_unavailable",
    1039: "ai.provider_busy",
    2013: "ai.provider_response_invalid",
    2049: "ai.key_rejected",
    2064: "ai.provider_unavailable",
  },
}

/*
 * Gemini (OpenAI compatibility endpoint, in beta). Verified 2026-11-17 against:
 *   https://aistudio.google.com/docs/openai (was ai.google.dev/gemini-api/docs/openai:
 *     base address https://generativelanguage.googleapis.com/v1beta/openai/, path
 *     chat/completions, `Authorization: Bearer`, model in the chat examples,
 *     `reasoning_effort`)
 *   https://aistudio.google.com/docs/api-errors (401 key, 402 prepaid credit used up,
 *     403 no permission or billing, 429 rate or quota, 5xx)
 *   https://aistudio.google.com/docs/pricing
 *   https://aistudio.google.com/docs/terms (unpaid quota: content improves Google's
 *     products and people may read it; paid: it does not; stored in any country Google
 *     has facilities)
 * Not verified: `response_format: json_object` in a REST body (shown only through the
 * SDK helpers): off. A field that caps the output on this endpoint: none is sent. The
 * error body's shape on this endpoint (only the status is read). Image input is
 * documented but `vision` waits for its connector (Aşama 5).
 */
const GEMINI: AiService = {
  id: "gemini",
  credentialProvider: "gemini",
  funding: "own_key",
  hosts: ["generativelanguage.googleapis.com"],
  downloadHosts: [],
  capabilities: {
    text: {
      connector: "openai-compatible",
      model: "gemini-4-hydrogen",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      path: "/chat/completions",
      maxTokensField: null,
      jsonMode: false,
      // Thinking cannot be turned off on this model; the lowest documented effort in the example
      body: { reasoning_effort: "low" },
    },
    /*
     * Image editing (Aşama 4), native API only. Verified 2026-11-18 against:
     *   https://aistudio.google.com/docs/image-generation?generate-content=true (the
     *     generateContent REST example: POST .../v1/models/{model}:generateContent,
     *     `x-goog-api-key`, `inline_data` + text parts, `responseModalities`, the image
     *     back as base64 `inlineData`, no address; "All generated images include a
     *     SynthID watermark")
     *   https://aistudio.google.com/api-reference/generate-content (`promptFeedback.blockReason`,
     *     `finishReason` IMAGE_SAFETY / NO_IMAGE…, `usageMetadata`)
     *   https://aistudio.google.com/docs/openai (no image editing on the compatibility endpoint)
     *   https://aistudio.google.com/docs/pricing (gemini-nano-banana-2.1)
     * Not verified: the v1beta path with image models (the reference says v1beta, the
     * example v1: the example's is used). A transparent result: white only.
     */
    image_edit: {
      connector: "gemini-image",
      model: "gemini-nano-banana-2.1",
      url: "https://generativelanguage.googleapis.com/v1/models/gemini-nano-banana-2.1:generateContent",
      backgrounds: ["white"],
    },
  },
  unitPrices: {
    text: { currency: "USD", inputPerMillionTokens: 1_500_000, outputPerMillionTokens: 7_500_000 },
    image_edit: {
      currency: "USD",
      inputPerMillionTokens: 1_500_000,
      outputPerMillionTokens: 30_000_000,
    },
  },
  dataNoteKey: "ai.data_note.gemini",
}

/*
 * Photoroom (Remove Background API). Verified 2026-11-18 against:
 *   https://docs.photoroom.com/remove-background-api-basic-plan/quickstart-guide.md
 *     (POST https://sdk.photoroom.com/v1/segment, multipart `image_file`, `x-api-key`)
 *   https://docs.photoroom.com/remove-background-api-basic-plan/background-color-size-and-crop.md
 *     (`bg_color` hex or an HTML colour name, `format` png | jpg | webp, `size`, `crop`)
 *   https://docs.photoroom.com/getting-started/api-reference-openapi.md (200: the image,
 *     or JSON `base64img`; 400 / 402 `{detail, status_code, type}`; 403; /v2/account)
 *   https://docs.photoroom.com/remove-background-api-basic-plan/file-size-resolution-and-format.md
 *     (input up to 50 MB and 6000 px; PNG, JPEG, WEBP, HEIC in; PNG, JPEG, WEBP out)
 *   https://docs.photoroom.com/remove-background-api-basic-plan/sandbox-mode.md (a
 *     `sandbox_` key: free, watermarked)
 *   https://docs.photoroom.com/remove-background-api-basic-plan/pricing.md ($0.02 an image)
 *   https://www.photoroom.com/platform/security (servers in the US; an image of a
 *     synchronous call is dropped after the answer)
 * The Image Editing API (/v2/edit: shadows, margins) is a dearer plan and not used.
 * Not verified: which header picks JSON over the bytes (both are read); what 403 means
 * (read as a refused key); whether self-serve images train models (the pages disagree:
 * the note says so). No result address is ever returned: no download host.
 */
const PHOTOROOM: AiService = {
  id: "photoroom",
  credentialProvider: "photoroom",
  funding: "own_key",
  hosts: ["sdk.photoroom.com", "image-api.photoroom.com"],
  downloadHosts: [],
  capabilities: {
    image_edit: {
      connector: "photoroom",
      model: "segment-v1",
      url: "https://sdk.photoroom.com/v1/segment",
      backgrounds: ["transparent", "white"],
    },
  },
  // Priced by the image, which the token table cannot hold: no estimate (ai_usage.images counts)
  unitPrices: {},
  dataNoteKey: "ai.data_note.photoroom",
}

/**
 * NODE_ENV test and development only (never staging or production):
 * writes from the data alone, never leaves the machine. Connected like
 * any service, through its own credential provider (`fake`,
 * `providers-ai.ts`, offered under the same rule); its connector is
 * reached only through `connector-of.ts`.
 */
export const FAKE_SERVICE: AiService = {
  id: "fake",
  credentialProvider: "fake",
  funding: "own_key",
  hosts: [],
  downloadHosts: [],
  capabilities: {
    text: { connector: "fake", model: "fake-text" },
    vision: { connector: "fake", model: "fake-vision" },
    image_edit: {
      connector: "fake-image",
      model: "fake-image",
      backgrounds: ["transparent", "white"],
    },
  },
  unitPrices: {},
  dataNoteKey: "ai.data_note.fake",
}

const SERVICES: readonly AiService[] = [DEEPSEEK, MINIMAX, GEMINI, PHOTOROOM]

/** The services of this instance, in registry order (the order a choice falls back to). */
export function aiServices(
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): readonly AiService[] {
  return nodeEnv === "test" || nodeEnv === "development" ? [...SERVICES, FAKE_SERVICE] : SERVICES
}

export function findAiService(
  id: string,
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): AiService | null {
  return aiServices(nodeEnv).find((service) => service.id === id) ?? null
}
