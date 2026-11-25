import { AI_FAKE_TARGET, AI_SERVICE_TARGETS, endpointUrl } from "@qticaret/types/control-plane"
import type {
  AiCapabilityTarget,
  AiCreditCapability,
  AiCreditTask,
  AiServiceTarget,
  AiTargetAuth,
  AiUnitPrice,
} from "@qticaret/types/control-plane"

/**
 * Where a call goes (adr/0085 §2): the shared target table alone picks the
 * address, never the shop's request. The address is `https`, on one of
 * the service's hosts, without a query (a key never rides in it: Gemini's
 * goes in `x-goog-api-key`). A scene (`image_scene`) has its own endpoint.
 *
 * The fake service has no address in the table. Under `NODE_ENV=test`
 * only, the control plane's tests point it at their own provider on the
 * loopback (`AI_GATEWAY_FAKE_URL`, `http://127.0.0.1:<port>`); anywhere
 * else, and in production always, it is unreachable.
 */

export interface GatewayTarget {
  service: string
  url: URL
  model: string
  protocol: AiCapabilityTarget["protocol"]
  auth: AiTargetAuth
  maxTokensField: "max_tokens" | "max_completion_tokens" | null
  price: AiUnitPrice | null
  /** A 200 body code meaning the service did no work (MiniMax). */
  notTakenBodyCodes: readonly number[]
  /** The fake service's own time, in tests only. */
  timeoutMs?: number
}

export const FAKE_URL_ENV = "AI_GATEWAY_FAKE_URL"
/** The fake call's time in milliseconds (tests of a timeout); the capability's otherwise. */
export const FAKE_TIMEOUT_ENV = "AI_GATEWAY_FAKE_TIMEOUT_MS"

const fakeTimeout = (): { timeoutMs?: number } => {
  const value = Number(process.env[FAKE_TIMEOUT_ENV] ?? "")
  return Number.isSafeInteger(value) && value > 0 ? { timeoutMs: value } : {}
}

/** The fake service's endpoints, as Photoroom's for a picture (a form) and OpenAI's for text. */
function fakeTarget(capability: AiCreditCapability, task: AiCreditTask): GatewayTarget | null {
  if (process.env["NODE_ENV"] !== "test") {
    return null
  }
  const base = process.env[FAKE_URL_ENV]
  if (base === undefined || !URL.canParse(base)) {
    return null
  }
  const root = new URL(base)
  if (root.protocol !== "http:" || root.hostname !== "127.0.0.1") {
    return null
  }
  const edit = capability === "image_edit"
  const models = AI_FAKE_TARGET.capabilities
  return {
    service: AI_FAKE_TARGET.id,
    url: new URL(edit ? (task === "image_scene" ? "/scene" : "/edit") : "/chat", root),
    model: edit
      ? task === "image_scene"
        ? models.image_edit.scene.model
        : models.image_edit.model
      : models[capability].model,
    protocol: edit ? "photoroom" : "openai-chat",
    auth: edit ? "x-api-key" : "bearer",
    maxTokensField: edit ? null : "max_tokens",
    price: edit
      ? { currency: "USD", perImage: 1_000 }
      : { currency: "USD", inputPerMillionTokens: 1_000_000, outputPerMillionTokens: 2_000_000 },
    notTakenBodyCodes: [],
    ...fakeTimeout(),
  }
}

/** An address from the table, held to its service's hosts once more; null if it is not. */
function fixedUrl(service: AiServiceTarget, address: string): URL | null {
  if (!URL.canParse(address)) {
    return null
  }
  const url = new URL(address)
  const clean = url.protocol === "https:" && url.port === "" && url.search === "" && url.hash === ""
  return clean && url.username === "" && service.hosts.includes(url.hostname) ? url : null
}

/** The endpoint a task's call on a service goes to, or null: nowhere it may go. */
export function gatewayTargetOf(
  serviceId: string,
  capability: AiCreditCapability,
  task: AiCreditTask
): GatewayTarget | null {
  if (serviceId === AI_FAKE_TARGET.id) {
    return fakeTarget(capability, task)
  }
  if (!Object.hasOwn(AI_SERVICE_TARGETS, serviceId)) {
    return null
  }
  const service = AI_SERVICE_TARGETS[
    serviceId as keyof typeof AI_SERVICE_TARGETS
  ] as AiServiceTarget
  const target = service.capabilities[capability]
  if (target === undefined) {
    return null
  }
  const endpoint = task === "image_scene" ? target.scene : target
  if (endpoint === undefined) {
    return null
  }
  const url = fixedUrl(service, endpointUrl(endpoint))
  if (url === null) {
    return null
  }
  return {
    service: serviceId,
    url,
    model: endpoint.model,
    protocol: target.protocol,
    auth: target.auth,
    maxTokensField: target.maxTokensField ?? null,
    price: endpoint.price ?? target.price ?? null,
    notTakenBodyCodes: service.notTakenBodyCodes ?? [],
  }
}
