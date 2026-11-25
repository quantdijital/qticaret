/**
 * Where each AI service is called (adr/0085 §2): its hosts and, per
 * capability, the endpoint's address, the header its key goes in and the
 * model it runs. Data only, one source for both apps: the shop's service
 * registry (apps/backend `lib/ai/registry/services.ts`) reads its targets
 * from here, and the control plane's gateway picks an address from this
 * table alone, never from a request. What each service was verified
 * against stays above its record in the shop's registry.
 */

/** The capabilities a target is written for (the shop's `AiCapability` names). */
export const AI_TARGET_CAPABILITIES = ["text", "vision", "image_edit"] as const
export type AiTargetCapability = (typeof AI_TARGET_CAPABILITIES)[number]

/** How the key travels: `Authorization: Bearer …`, `x-api-key`, `x-goog-api-key`. Never in the address. */
export const AI_TARGET_AUTH_HEADERS = ["bearer", "x-api-key", "x-goog-api-key"] as const
export type AiTargetAuth = (typeof AI_TARGET_AUTH_HEADERS)[number]

/**
 * A call's estimated price (adr/0085 K12) in millionths of a US dollar:
 * per million tokens in and out, or per image given back. The shop's
 * registry holds the same values (a parity test in the control plane).
 */
export type AiUnitPrice =
  | { currency: "USD"; inputPerMillionTokens: number; outputPerMillionTokens: number }
  | { currency: "USD"; perImage: number }

/** One endpoint: `https`, on one of the service's hosts; the address is `baseUrl` + `path`. */
export interface AiEndpointTarget {
  model: string
  /** `https://host[/prefix]`, no trailing slash, no query. */
  baseUrl: string
  /** Starts with `/`; appended to `baseUrl` as it is. */
  path: string
  /** A scene endpoint's own price; its capability's when left out. */
  price?: AiUnitPrice
}

export interface AiCapabilityTarget extends AiEndpointTarget {
  /** The request's shape: OpenAI-compatible chat completions, or the service's own. */
  protocol: "openai-chat" | "photoroom" | "gemini-image"
  auth: AiTargetAuth
  /**
   * `openai-chat` only: the body field holding the output budget; null
   * where the target takes none (the field is then left out). A chat
   * target without one is never routed on the platform's credits: its
   * output could not be capped (adr/0085 "çıktı tavanını istekten almaz").
   */
  maxTokensField?: "max_tokens" | "max_completion_tokens" | null
  /**
   * The body fields the service documents for this endpoint and the
   * gateway writes whatever a shop sent (thinking off, reasoning apart,
   * one picture asked for). The shop's registry writes the same ones for
   * a chat target (`body`, a parity test in the control plane).
   */
  fixedBody?: Readonly<Record<string, unknown>>
  /** `image_edit` only: a product set in a scene (`image_scene`), its own endpoint. */
  scene?: AiEndpointTarget
}

export interface AiServiceTarget {
  /** The only hosts a call may go to. */
  hosts: readonly string[]
  capabilities: Readonly<Partial<Record<AiTargetCapability, AiCapabilityTarget>>>
  /**
   * A 200 whose body carries one of these codes (`base_resp.status_code`,
   * MiniMax) is a refusal the service did no work for: the shop gives its
   * quota back, the gateway its credits (the shop's `notTakenByService`).
   */
  notTakenBodyCodes?: readonly number[]
}

/** `baseUrl` + `path`: the endpoint's full address. */
export const endpointUrl = (endpoint: AiEndpointTarget): string =>
  `${endpoint.baseUrl}${endpoint.path}`

/**
 * `value` frozen all the way down (PR #371 D5): no importer can add a host
 * to a service's list or swap an address in place. Objects shared between
 * entries are frozen once more, harmlessly; the table has no cycles.
 */
function deepFrozen<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) {
      deepFrozen(child)
    }
    Object.freeze(value)
  }
  return value
}

const tokens = (input: number, output: number) =>
  ({ currency: "USD", inputPerMillionTokens: input, outputPerMillionTokens: output }) as const

const DEEPSEEK_CHAT = {
  protocol: "openai-chat",
  auth: "bearer",
  model: "deepseek-flash",
  baseUrl: "https://api.deepseek.com",
  path: "/chat/completions",
  maxTokensField: "max_tokens",
  // Thinking is on unless turned off
  fixedBody: { thinking: { type: "disabled" } },
  price: tokens(300_000, 1_200_000),
} as const

const MINIMAX_CHAT = {
  protocol: "openai-chat",
  auth: "bearer",
  model: "MiniMax-M3.1-Flash",
  baseUrl: "https://api.minimax.io/v1",
  path: "/chat/completions",
  maxTokensField: "max_completion_tokens",
  // The model always thinks; its thinking goes to its own field, not into the text
  fixedBody: { reasoning_split: true, reasoning_effort: "low" },
  price: tokens(150_000, 600_000),
} as const

/*
 * Not on the platform's credits (adr/0085, security review of P3b): the
 * OpenAI-compatible endpoint documents no field that caps the output
 * (aistudio.google.com/docs/openai, read 2026-11-25) and Gemini 4's
 * thinking cannot be turned off, so one credit's call could run to any
 * length. Routing refuses it (`cp.ai_route_uncapped`) and the gateway
 * answers `unavailable`; opened once a documented cap is written here.
 */
const GEMINI_CHAT = {
  protocol: "openai-chat",
  auth: "bearer",
  model: "gemini-4-hydrogen",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  path: "/chat/completions",
  maxTokensField: null,
  // Thinking cannot be turned off on this model; the lowest documented effort
  fixedBody: { reasoning_effort: "low" },
  price: tokens(1_500_000, 7_500_000),
} as const

const GEMINI_IMAGE = {
  model: "gemini-nano-banana-2.1",
  baseUrl: "https://generativelanguage.googleapis.com",
  path: "/v1/models/gemini-nano-banana-2.1:generateContent",
  price: tokens(1_500_000, 30_000_000),
} as const

/** The networked services, by the shop registry's service id. */
export const AI_SERVICE_TARGETS = deepFrozen({
  deepseek: {
    hosts: ["api.deepseek.com"],
    capabilities: { text: DEEPSEEK_CHAT, vision: DEEPSEEK_CHAT },
  },
  minimax: {
    hosts: ["api.minimax.io"],
    capabilities: { text: MINIMAX_CHAT, vision: MINIMAX_CHAT },
    // The shop's `bodyErrors` whose key is not taken: busy, key, balance, quota
    notTakenBodyCodes: [1002, 1004, 1008, 1039, 2049, 2053, 2056, 2061, 2067, 2068],
  },
  gemini: {
    hosts: ["generativelanguage.googleapis.com"],
    capabilities: {
      text: GEMINI_CHAT,
      vision: GEMINI_CHAT,
      image_edit: {
        protocol: "gemini-image",
        auth: "x-goog-api-key",
        // The shop's connector's own (an image asked for alone); the one answer
        // (`candidateCount: 1`) is the gateway's own field, written last
        fixedBody: { generationConfig: { responseModalities: ["IMAGE"] } },
        ...GEMINI_IMAGE,
        scene: GEMINI_IMAGE,
      },
    },
  },
  photoroom: {
    hosts: ["sdk.photoroom.com", "image-api.photoroom.com"],
    capabilities: {
      image_edit: {
        protocol: "photoroom",
        auth: "x-api-key",
        model: "segment-v1",
        baseUrl: "https://sdk.photoroom.com",
        path: "/v1/segment",
        price: { currency: "USD", perImage: 20_000 },
        scene: {
          model: "edit-v2-ai-background",
          baseUrl: "https://image-api.photoroom.com",
          path: "/v2/edit",
          price: { currency: "USD", perImage: 100_000 },
        },
      },
    },
  },
} as const satisfies Record<string, AiServiceTarget>)

export type AiNetworkServiceId = keyof typeof AI_SERVICE_TARGETS

/**
 * "Test the connection" (adr/0071 §3, adr/0085 §2): each service's
 * cheapest call that proves a key and generates nothing, the model list
 * (Photoroom, which has none: its account). Verified as the shop's
 * `lib/ai/account-check.ts` says (2026-11-17, 2026-11-18). `documented:
 * false`: the check is not fully documented, so only a 401 refuses the key.
 */
export interface AiServiceCheck {
  url: string
  auth: "bearer" | "x-api-key"
  answer: "model_list" | "photoroom_account"
  documented?: false
}

export const AI_SERVICE_CHECKS = deepFrozen({
  deepseek: { url: "https://api.deepseek.com/models", auth: "bearer", answer: "model_list" },
  minimax: { url: "https://api.minimax.io/v1/models", auth: "bearer", answer: "model_list" },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/models",
    auth: "bearer",
    answer: "model_list",
  },
  photoroom: {
    url: "https://image-api.photoroom.com/v2/account",
    auth: "x-api-key",
    answer: "photoroom_account",
    documented: false,
  },
} as const satisfies Record<AiNetworkServiceId, AiServiceCheck>)

/**
 * The fake service (NODE_ENV test and development only): models and no
 * address; it never leaves the machine. Listed so either app's tests can
 * route to it.
 */
export const AI_FAKE_TARGET = deepFrozen({
  id: "fake",
  capabilities: {
    text: { model: "fake-text" },
    vision: { model: "fake-vision" },
    image_edit: { model: "fake-image", scene: { model: "fake-scene" } },
  },
} as const)

const fakeListed = (nodeEnv: string | undefined): boolean =>
  nodeEnv === "test" || nodeEnv === "development"

/** The service ids a target is listed for under `nodeEnv` (the fake one in test and development). */
export function aiTargetServiceIds(nodeEnv: string | undefined): readonly string[] {
  const ids = Object.keys(AI_SERVICE_TARGETS)
  return fakeListed(nodeEnv) ? [...ids, AI_FAKE_TARGET.id] : ids
}

/**
 * A chat target whose output no documented field caps: never routed on
 * the platform's credits (see `GEMINI_CHAT`). False for any other, and
 * for a service or capability not in the table.
 */
export function aiTargetUncapped(service: string, capability: string): boolean {
  if (!Object.hasOwn(AI_SERVICE_TARGETS, service)) {
    return false
  }
  const target: AiCapabilityTarget | undefined = (
    AI_SERVICE_TARGETS[service as AiNetworkServiceId] as AiServiceTarget
  ).capabilities[capability as AiTargetCapability]
  return target?.protocol === "openai-chat" && (target.maxTokensField ?? null) === null
}

/** What a capability of a service may be routed to: the models it runs, or null where it has none. */
export function aiTargetModels(
  service: string,
  capability: string,
  nodeEnv: string | undefined
): readonly string[] | null {
  if (!(AI_TARGET_CAPABILITIES as readonly string[]).includes(capability)) {
    return null
  }
  const key = capability as AiTargetCapability
  if (service === AI_FAKE_TARGET.id) {
    return fakeListed(nodeEnv) ? [AI_FAKE_TARGET.capabilities[key].model] : null
  }
  if (!Object.hasOwn(AI_SERVICE_TARGETS, service)) {
    return null
  }
  const target: AiCapabilityTarget | undefined = (
    AI_SERVICE_TARGETS[service as AiNetworkServiceId] as AiServiceTarget
  ).capabilities[key]
  return target ? [target.model] : null
}
