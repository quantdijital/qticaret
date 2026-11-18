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
  /**
   * `vision` only: images go in the user message as `image_url` parts with
   * a base64 `data:` URL (never an address of our storage), each at most
   * `maxBytes` before encoding. Left out: the target takes no image.
   */
  imageInput?: { maxBytes: number }
}

export interface FakeTarget {
  connector: "fake"
  model: string
}

export type AiTarget = OpenAiCompatibleTarget | FakeTarget

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
 * Not verified: the error body's shape (only the status is read).
 *
 * `vision` verified 2026-11-18 against:
 *   https://api-docs.deepseek.com/guides/vision (`deepseek-flash` accepts images; JPEG,
 *     PNG, GIF, WebP, told from the content; a base64 `data:` URL in an `image_url` part;
 *     32 MiB an image, 48 MiB a request; image tokens billed with the text tokens)
 *   https://api-docs.deepseek.com/api/create-chat-completion (`image_url` content parts)
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
    vision: {
      connector: "openai-compatible",
      model: "deepseek-flash",
      baseUrl: "https://api.deepseek.com",
      path: "/chat/completions",
      maxTokensField: "max_tokens",
      jsonMode: false,
      body: { thinking: { type: "disabled" } },
      imageInput: { maxBytes: 32 * 1024 * 1024 },
    },
  },
  unitPrices: {
    text: { currency: "USD", inputPerMillionTokens: 300_000, outputPerMillionTokens: 1_200_000 },
    vision: { currency: "USD", inputPerMillionTokens: 300_000, outputPerMillionTokens: 1_200_000 },
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
 * privacy policy could not be read): the note says so.
 *
 * `vision` verified 2026-11-18 against:
 *   https://platform.minimax.io/docs/api-reference/text-chat-openai (`MiniMax-M3.1-Flash`
 *     and `MiniMax-M3` take image content parts; `image_url.url` is an image address or a
 *     base64 data URL; JPEG, PNG, GIF, WEBP; an image at most 10 MB, a request 64 MB)
 * Not verified: a separate price for image input (the pricing page lists none for the
 * model): the text prices are used for the estimate, image tokens counted as input.
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
    vision: {
      connector: "openai-compatible",
      model: "MiniMax-M3.1-Flash",
      baseUrl: "https://api.minimax.io/v1",
      path: "/chat/completions",
      maxTokensField: "max_completion_tokens",
      jsonMode: false,
      body: { reasoning_split: true, reasoning_effort: "low" },
      imageInput: { maxBytes: 10 * 1000 * 1000 },
    },
  },
  unitPrices: {
    text: { currency: "USD", inputPerMillionTokens: 150_000, outputPerMillionTokens: 600_000 },
    vision: { currency: "USD", inputPerMillionTokens: 150_000, outputPerMillionTokens: 600_000 },
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
 * error body's shape on this endpoint (only the status is read).
 *
 * `vision` verified 2026-11-18 against:
 *   https://aistudio.google.com/docs/openai ("Image understanding": an `image_url` part
 *     with a base64 `data:image/jpeg;base64,…` URL, model `gemini-4-hydrogen`)
 *   https://aistudio.google.com/docs/image-understanding (PNG, JPEG, WEBP, HEIC, HEIF;
 *     inline data keeps the whole request under 20 MB; images are counted in tokens)
 *   https://aistudio.google.com/docs/pricing (one input price, no split by modality)
 * Not verified: whether the compatibility endpoint takes a remote image address (every
 * example is base64): only base64 is sent, as for every service.
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
    vision: {
      connector: "openai-compatible",
      model: "gemini-4-hydrogen",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      path: "/chat/completions",
      maxTokensField: null,
      jsonMode: false,
      body: { reasoning_effort: "low" },
      // 20 MB is the whole request, base64 and text included: room for the encoding's third
      imageInput: { maxBytes: 14 * 1000 * 1000 },
    },
  },
  unitPrices: {
    text: { currency: "USD", inputPerMillionTokens: 1_500_000, outputPerMillionTokens: 7_500_000 },
    vision: {
      currency: "USD",
      inputPerMillionTokens: 1_500_000,
      outputPerMillionTokens: 7_500_000,
    },
  },
  dataNoteKey: "ai.data_note.gemini",
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
  },
  unitPrices: {},
  dataNoteKey: "ai.data_note.fake",
}

const SERVICES: readonly AiService[] = [DEEPSEEK, MINIMAX, GEMINI]

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
