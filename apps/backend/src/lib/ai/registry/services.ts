import { AI_FAKE_TARGET, AI_SERVICE_TARGETS as T, endpointUrl } from "@qticaret/types/control-plane"
import type { AiSource } from "../../media/ai-source"
import type { AiErrorKey } from "../errors"
import type { AiCapability } from "./capabilities"
import { BRIA } from "./service-bria"

/**
 * The AI services a shop can connect (adr/0071 §2). A fixed registry: no
 * user, setting or service answer can name a base address (§9 SSRF). A
 * capability is listed only after it was checked against the service's
 * own current documentation; the date and the pages stand above each
 * record. What could not be verified is not here. The network targets
 * (hosts, addresses, models) are read from the shared table the control
 * plane's gateway calls from (`AI_SERVICE_TARGETS`, adr/0085 §2).
 */

export type AiFunding = "own_key" | "platform_credit"

/**
 * Micro units (a millionth of the currency) per million tokens, or per
 * image a call gives back (a service priced by the image); an estimate,
 * never an invoice.
 */
export type AiUnitPrice =
  | { currency: "USD"; inputPerMillionTokens: number; outputPerMillionTokens: number }
  | { currency: "USD"; perImage: number }

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
   * `temperature` (0 to 2) is documented for this endpoint and model, with
   * thinking as set in `body` (adr/0074 §4). Left out: the task's
   * temperature is never sent. Set only after checking the service's page.
   */
  temperature?: true
  /**
   * `vision` only: images go in the user message as `image_url` parts with
   * a base64 `data:` URL (never an address of our storage), each at most
   * `maxBytes` before encoding. Left out: the target takes no image.
   */
  imageInput?: { maxBytes: number }
  /** Tool calling (adr/0079 §2): the panel assistant's only way in. */
  toolCalls?: ToolCallSupport
}

/**
 * Tool calling as the service documents it for this endpoint (adr/0079
 * §2): `tools` in the request, `tool_calls` in the answer, a result back
 * as a `tool` message with its `tool_call_id`. A record is written after
 * the pages are read, with their date and addresses; `verified: false`
 * keeps the service out of the assistant (its other tasks run as before).
 */
export interface ToolCallSupport {
  verified: boolean
  /** `YYYY-MM-DD`, the day the pages were read. */
  verifiedOn: string
  /** The pages read. */
  source: readonly string[]
  /** `tool_choice: "auto"` is documented: sent; else left out (the service's default). */
  toolChoice: boolean
}

export interface FakeTarget {
  connector: "fake"
  model: string
  toolCalls?: ToolCallSupport
}

/** What an `image_edit` service is asked to do with the background (`image_background`). */
export const IMAGE_BACKGROUNDS = ["transparent", "white"] as const
export type ImageBackground = (typeof IMAGE_BACKGROUNDS)[number]

/**
 * A scene endpoint (Aşama 7, `image_scene`): the product photo set in one
 * of the shop's ready-made scenes. `source` is what the result is marked
 * as (IPTC, lib/media/ai-source.ts): `edited` where the product's own
 * pixels are kept and only the setting is made (a composite), `generated`
 * where the service draws the whole picture anew from the photo.
 */
export interface ImageSceneTarget {
  model: string
  /** `https`, on one of the service's `hosts`; no query. */
  url: string
  source: AiSource
  /** A scene's own price where it differs from the service's `image_edit` one. */
  unitPrice?: AiUnitPrice
  /** `bria`: the fixed body fields of this endpoint (the shared table's `fixedBody`). */
  body?: Readonly<Record<string, unknown>>
}

/** An image editing endpoint (Aşama 4): its full address, fixed here. */
export interface ImageEditTarget {
  connector: "photoroom" | "gemini-image" | "bria"
  model: string
  /** `https`, on one of the service's `hosts`; no query. */
  url: string
  /** The backgrounds this endpoint is documented to make (or made here from its own). */
  backgrounds: readonly ImageBackground[]
  /** `bria`: the fixed body fields of this endpoint (the shared table's `fixedBody`). */
  body?: Readonly<Record<string, unknown>>
  /** Left out: the service is not documented to set a product in a scene. */
  scene?: ImageSceneTarget
}

export interface FakeImageTarget {
  connector: "fake-image"
  model: string
  backgrounds: readonly ImageBackground[]
  scene?: { model: string; source: AiSource }
}

export type AiTarget = OpenAiCompatibleTarget | FakeTarget | ImageEditTarget | FakeImageTarget

/** An image target's scene endpoint, or null where it has none (Aşama 7). */
export function sceneTargetOf(
  target: AiTarget | undefined
): ImageSceneTarget | NonNullable<FakeImageTarget["scene"]> | null {
  if (
    target?.connector === "photoroom" ||
    target?.connector === "gemini-image" ||
    target?.connector === "bria" ||
    target?.connector === "fake-image"
  ) {
    return target.scene ?? null
  }
  return null
}

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
  /**
   * How a 429's body tells a used-up quota from a rate
   * (`connectors/status-failure.ts`): `google-rpc`, the Google error with
   * `google.rpc.QuotaFailure` details. Left out: every 429 is a rate.
   */
  quotaErrors?: "google-rpc"
  /**
   * A status the service documents for a refusal of its own kind
   * (`connectors/status-failure.ts`), over the generic meaning of the
   * status: Bria's 422 is its moderation's, 415 a picture it does not read.
   */
  statusErrors?: Readonly<Record<number, AiErrorKey>>
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
 *   Checked again 2026-11-19: error_codes keeps balance (402) and rate (429) apart by
 *     status alone; no body field adds to it, so nothing more is read.
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
  hosts: T.deepseek.hosts,
  downloadHosts: [],
  capabilities: {
    text: {
      connector: "openai-compatible",
      model: T.deepseek.capabilities.text.model,
      baseUrl: T.deepseek.capabilities.text.baseUrl,
      path: T.deepseek.capabilities.text.path,
      maxTokensField: "max_tokens",
      jsonMode: true,
      // Thinking is on unless turned off; a title needs none
      body: { thinking: { type: "disabled" } },
      /*
       * Tool calling, read 2026-11-24 for adr/0079 §2: `tools` (function name,
       * description, JSON Schema parameters), `tool_calls` in the answer, the result as
       * `role: "tool"` with `tool_call_id`. `strict` only on the beta address (not used);
       * `minLength`/`maxLength` are not enforced: the loop checks every argument again.
       * `tool_choice` is not on the guide page: left out (its default, `auto`, with tools).
       */
      toolCalls: {
        verified: true,
        verifiedOn: "2026-11-24",
        source: ["https://api-docs.deepseek.com/guides/tool_calls"],
        toolChoice: false,
      },
    },
    vision: {
      connector: "openai-compatible",
      model: T.deepseek.capabilities.vision.model,
      baseUrl: T.deepseek.capabilities.vision.baseUrl,
      path: T.deepseek.capabilities.vision.path,
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
 *
 * Quota and plan codes verified 2026-11-19 against:
 *   https://platform.minimax.io/docs/api-reference/errorcode (2053 insufficient credit;
 *     2056 usage limit exceeded, wait for the next 5-hour window; 2061 the token plan
 *     does not support the model; 2067 usage limit reached and credit auto consumption
 *     off; 2068 the plan tier does not support the model)
 * 2062 ("M Plan rate limit", or no active plan when querying usage) says either: left out.
 */
const MINIMAX: AiService = {
  id: "minimax",
  credentialProvider: "minimax",
  funding: "own_key",
  hosts: T.minimax.hosts,
  downloadHosts: [],
  capabilities: {
    text: {
      connector: "openai-compatible",
      model: T.minimax.capabilities.text.model,
      baseUrl: T.minimax.capabilities.text.baseUrl,
      path: T.minimax.capabilities.text.path,
      maxTokensField: "max_completion_tokens",
      jsonMode: false,
      // The model always thinks; its thinking goes to its own field, not into the text
      body: { reasoning_split: true, reasoning_effort: "low" },
      /*
       * Tool calling, read 2026-11-24 for adr/0079 §2: `tools` is taken, `tool_calls`
       * documented only on a non-streaming answer, `tool_choice` not documented, nor how
       * a tool's result goes back. Not verified: the assistant cannot choose this service.
       */
      toolCalls: {
        verified: false,
        verifiedOn: "2026-11-24",
        source: ["https://platform.minimax.io/docs/api-reference/text-chat-openai"],
        toolChoice: false,
      },
    },
    vision: {
      connector: "openai-compatible",
      model: T.minimax.capabilities.vision.model,
      baseUrl: T.minimax.capabilities.vision.baseUrl,
      path: T.minimax.capabilities.vision.path,
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
    2053: "ai.provider_balance",
    2056: "ai.provider_quota",
    2061: "ai.provider_quota",
    2064: "ai.provider_unavailable",
    2067: "ai.provider_quota",
    2068: "ai.provider_quota",
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
 *
 * A used-up quota apart from a rate on 429 (`quotaErrors`). Verified 2026-11-19 against:
 *   https://aistudio.google.com/docs/api-errors (429 `rate_limit_exceeded`: the per-minute
 *     or per-second limit; `quota_exceeded`: the daily quota, wait for the reset or ask
 *     for more; `too_many_requests`)
 *   https://aistudio.google.com/docs/rate-limits (limits per project in RPM, TPM, RPD and,
 *     for image models, IPM; RPD resets at midnight Pacific time; tiers Free, Tier 1 with
 *     a billing account, Tier 2, Tier 3; any limit passed is a 429 RESOURCE_EXHAUSTED)
 *   https://aistudio.google.com/docs/pricing (every image generating model, Nano Banana
 *     2.1 among them: "Not available" on the free tier)
 *   https://google.aip.dev/193 (`error.code` the HTTP status, `error.status`,
 *     `error.details[]` by `@type`)
 *   https://github.com/googleapis/googleapis/blob/master/google/rpc/error_details.proto
 *     (`QuotaFailure.violations[]`: `quotaMetric`, `quotaId`, `quotaValue` the enforced
 *     value; `RetryInfo.retryDelay`)
 * What a free tier 429 for an image model carries is seen in the developer forum, not
 * on a documentation page (discuss.ai.google.dev, "Gemini Flash Image … RPM limit
 * errors"): `limit: 0` in the message and three `-FreeTier` violations, the per-minute
 * one included, with a RetryInfo. So a violation counts as a used-up quota when its
 * value is zero or its id is a daily or monthly one, never for `-FreeTier` alone.
 * Not verified: the compatibility endpoint's error body (read the same way; any other
 * shape is a rate, as before).
 */
const GEMINI: AiService = {
  id: "gemini",
  credentialProvider: "gemini",
  funding: "own_key",
  hosts: T.gemini.hosts,
  downloadHosts: [],
  capabilities: {
    text: {
      connector: "openai-compatible",
      model: T.gemini.capabilities.text.model,
      baseUrl: T.gemini.capabilities.text.baseUrl,
      path: T.gemini.capabilities.text.path,
      maxTokensField: null,
      jsonMode: false,
      // Thinking cannot be turned off on this model; the lowest documented effort in the example
      body: { reasoning_effort: "low" },
      /*
       * Tool calling, read 2026-11-24 for adr/0079 §2 (Context7
       * /websites/ai_google_dev_gemini-api): the compatibility endpoint takes `tools` and
       * `tool_choice` (`auto`) and answers `tool_calls`, as OpenAI's chat completions do.
       * The native API's `validated` mode is not used (one shared way, adr/0071 karar 2).
       */
      toolCalls: {
        verified: true,
        verifiedOn: "2026-11-24",
        source: [
          "https://ai.google.dev/gemini-api/docs/openai",
          "https://ai.google.dev/gemini-api/docs/function-calling",
        ],
        toolChoice: true,
      },
    },
    vision: {
      connector: "openai-compatible",
      model: T.gemini.capabilities.vision.model,
      baseUrl: T.gemini.capabilities.vision.baseUrl,
      path: T.gemini.capabilities.vision.path,
      maxTokensField: null,
      jsonMode: false,
      body: { reasoning_effort: "low" },
      // 20 MB is the whole request, base64 and text included: room for the encoding's third
      imageInput: { maxBytes: 14 * 1000 * 1000 },
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
      model: T.gemini.capabilities.image_edit.model,
      url: endpointUrl(T.gemini.capabilities.image_edit),
      backgrounds: ["white"],
      /*
       * A scene (Aşama 7). Verified 2026-11-18 against:
       *   https://aistudio.google.com/docs/image-generation?generate-content=true ("Image
       *     editing (text-and-image-to-image)": the same generateContent call, a text part
       *     and an `inline_data` part; product shots for e-commerce with lighting and
       *     surface described; critical details kept by describing them with the edit;
       *     the output matches the input's size unless `image_config` says otherwise;
       *     "All generated images include a SynthID watermark")
       * The model draws the whole picture, the product included: marked `generated`. The
       * Interactions endpoint the page also shows is not used (one endpoint, as Aşama 4).
       */
      scene: {
        model: T.gemini.capabilities.image_edit.scene.model,
        url: endpointUrl(T.gemini.capabilities.image_edit.scene),
        source: "generated",
      },
    },
  },
  unitPrices: {
    text: { currency: "USD", inputPerMillionTokens: 1_500_000, outputPerMillionTokens: 7_500_000 },
    vision: {
      currency: "USD",
      inputPerMillionTokens: 1_500_000,
      outputPerMillionTokens: 7_500_000,
    },
    image_edit: {
      currency: "USD",
      inputPerMillionTokens: 1_500_000,
      outputPerMillionTokens: 30_000_000,
    },
  },
  dataNoteKey: "ai.data_note.gemini",
  quotaErrors: "google-rpc",
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
 * The Image Editing API (/v2/edit) is a dearer plan, used only for a scene (below).
 * Not verified: which header picks JSON over the bytes (both are read); what 403 means
 * (read as a refused key); whether self-serve images train models (the pages disagree:
 * the note says so). No result address is ever returned: no download host.
 * Checked again 2026-11-19 (the OpenAPI page above): no 429 and no rate limit are
 * documented, 402 is the only payment answer; nothing more is read.
 */
const PHOTOROOM: AiService = {
  id: "photoroom",
  credentialProvider: "photoroom",
  funding: "own_key",
  hosts: T.photoroom.hosts,
  downloadHosts: [],
  capabilities: {
    image_edit: {
      connector: "photoroom",
      model: T.photoroom.capabilities.image_edit.model,
      url: endpointUrl(T.photoroom.capabilities.image_edit),
      backgrounds: ["transparent", "white"],
      /*
       * A scene (Aşama 7): AI Backgrounds of the Image Editing API. Verified 2026-11-18:
       *   https://docs.photoroom.com/image-editing-api-plus-plan/ai-backgrounds.md (POST
       *     https://image-api.photoroom.com/v2/edit, `x-api-key`, multipart `imageFile`,
       *     `background.prompt`, `referenceBox=originalImage`)
       *   https://docs.photoroom.com/getting-started/api-reference-openapi.md (multipart
       *     only; `imageFile` up to 30 MB; 200 is the PNG itself, errors JSON; 400, 402)
       *   https://docs.photoroom.com/image-editing-api-plus-plan/pricing.md ($0.10 a call,
       *     every edit option included; sandbox mode)
       *   https://www.photoroom.com/api/pricing (a Basic key calling the Image Editing API
       *     is charged the Plus price; AI Backgrounds is a Plus feature)
       * The subject is cut out and kept; only the setting is made: marked `edited`.
       * Not verified: a prompt length limit (none documented; ours are at most 400).
       */
      scene: {
        model: T.photoroom.capabilities.image_edit.scene.model,
        url: endpointUrl(T.photoroom.capabilities.image_edit.scene),
        source: "edited",
        unitPrice: { currency: "USD", perImage: 100_000 },
      },
    },
  },
  // $0.02 a processed image (pricing.md above); billed per image given back
  unitPrices: { image_edit: { currency: "USD", perImage: 20_000 } },
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
    text: {
      connector: "fake",
      model: AI_FAKE_TARGET.capabilities.text.model,
      // Its own scenario (connectors/fake-tools.ts): no pages to read, nothing leaves the machine
      toolCalls: { verified: true, verifiedOn: "2026-11-24", source: [], toolChoice: false },
    },
    vision: { connector: "fake", model: AI_FAKE_TARGET.capabilities.vision.model },
    image_edit: {
      connector: "fake-image",
      model: AI_FAKE_TARGET.capabilities.image_edit.model,
      backgrounds: ["transparent", "white"],
      scene: { model: AI_FAKE_TARGET.capabilities.image_edit.scene.model, source: "generated" },
    },
  },
  unitPrices: {},
  dataNoteKey: "ai.data_note.fake",
}

const SERVICES: readonly AiService[] = [DEEPSEEK, MINIMAX, GEMINI, PHOTOROOM, BRIA]

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

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A service's tool calling where it is verified (adr/0079 §2): a date and
 * the pages read, the fake service needing none. Null keeps the service
 * out of the assistant; its other tasks are not touched.
 */
export function verifiedToolCalls(service: AiService): ToolCallSupport | null {
  const target = service.capabilities.text
  if (target?.connector !== "openai-compatible" && target?.connector !== "fake") {
    return null
  }
  const support = target.toolCalls
  const sourced = target.connector === "fake" || (support?.source.length ?? 0) > 0
  return support?.verified === true && DAY.test(support.verifiedOn) && sourced ? support : null
}
