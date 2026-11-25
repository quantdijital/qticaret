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

/** One endpoint: `https`, on one of the service's hosts; the address is `baseUrl` + `path`. */
export interface AiEndpointTarget {
  model: string
  /** `https://host[/prefix]`, no trailing slash, no query. */
  baseUrl: string
  /** Starts with `/`; appended to `baseUrl` as it is. */
  path: string
}

export interface AiCapabilityTarget extends AiEndpointTarget {
  /** The request's shape: OpenAI-compatible chat completions, or the service's own. */
  protocol: "openai-chat" | "photoroom" | "gemini-image"
  auth: AiTargetAuth
  /** `image_edit` only: a product set in a scene (`image_scene`), its own endpoint. */
  scene?: AiEndpointTarget
}

export interface AiServiceTarget {
  /** The only hosts a call may go to. */
  hosts: readonly string[]
  capabilities: Readonly<Partial<Record<AiTargetCapability, AiCapabilityTarget>>>
}

/** `baseUrl` + `path`: the endpoint's full address. */
export const endpointUrl = (endpoint: AiEndpointTarget): string =>
  `${endpoint.baseUrl}${endpoint.path}`

const DEEPSEEK_CHAT = {
  protocol: "openai-chat",
  auth: "bearer",
  model: "deepseek-flash",
  baseUrl: "https://api.deepseek.com",
  path: "/chat/completions",
} as const

const MINIMAX_CHAT = {
  protocol: "openai-chat",
  auth: "bearer",
  model: "MiniMax-M3.1-Flash",
  baseUrl: "https://api.minimax.io/v1",
  path: "/chat/completions",
} as const

const GEMINI_CHAT = {
  protocol: "openai-chat",
  auth: "bearer",
  model: "gemini-4-hydrogen",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  path: "/chat/completions",
} as const

const GEMINI_IMAGE = {
  model: "gemini-nano-banana-2.1",
  baseUrl: "https://generativelanguage.googleapis.com",
  path: "/v1/models/gemini-nano-banana-2.1:generateContent",
} as const

/** The networked services, by the shop registry's service id. */
export const AI_SERVICE_TARGETS = Object.freeze({
  deepseek: {
    hosts: ["api.deepseek.com"],
    capabilities: { text: DEEPSEEK_CHAT, vision: DEEPSEEK_CHAT },
  },
  minimax: {
    hosts: ["api.minimax.io"],
    capabilities: { text: MINIMAX_CHAT, vision: MINIMAX_CHAT },
  },
  gemini: {
    hosts: ["generativelanguage.googleapis.com"],
    capabilities: {
      text: GEMINI_CHAT,
      vision: GEMINI_CHAT,
      image_edit: {
        protocol: "gemini-image",
        auth: "x-goog-api-key",
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
        scene: {
          model: "edit-v2-ai-background",
          baseUrl: "https://image-api.photoroom.com",
          path: "/v2/edit",
        },
      },
    },
  },
} as const satisfies Record<string, AiServiceTarget>)

export type AiNetworkServiceId = keyof typeof AI_SERVICE_TARGETS

/**
 * The fake service (NODE_ENV test and development only): models and no
 * address; it never leaves the machine. Listed so either app's tests can
 * route to it.
 */
export const AI_FAKE_TARGET = Object.freeze({
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
