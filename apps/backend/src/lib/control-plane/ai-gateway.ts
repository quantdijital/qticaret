import { signRequest } from "@qticaret/server-kit"
import type { Ed25519Signer } from "@qticaret/server-kit"
import { controlPlaneConfig, tenantSigner } from "./config"
import type { Fetch } from "./pull"

/**
 * A signed request to the control plane's AI gateway (adr/0085 §2, §3)
 * under the pull's rules (Ek C9): plain `fetch` (the control plane is an
 * internal address, not a provider's), no redirect, the answer's bytes
 * capped, never sent twice (a signed request's nonce is single use).
 * This file speaks HTTP only; what an answer means is the AI transport's
 * (`lib/ai/transport/platform.ts`).
 */

/** Where the gateway is and how this shop signs; null on an unmanaged or unconfigured shop. */
export interface AiGatewayEndpoint {
  /** The control plane's origin. */
  url: string
  tenantId: string
  signer: Ed25519Signer
}

export function aiGatewayEndpoint(env: NodeJS.ProcessEnv = process.env): AiGatewayEndpoint | null {
  const config = controlPlaneConfig(env)
  if (!config.managed || !config.url || !config.tenantId) {
    return null
  }
  const signer = tenantSigner(env)
  return signer ? { url: config.url, tenantId: config.tenantId, signer } : null
}

export interface AiGatewayPost {
  endpoint: AiGatewayEndpoint
  /** Path and query, signed as they are sent. */
  path: string
  body: string | Buffer
  headers: Readonly<Record<string, string>>
  timeoutMs: number
  maxResponseBytes: number
  signal: AbortSignal
  fetch?: Fetch | undefined
  /** Milliseconds since the epoch; tests pass a fixed time. */
  now?: (() => number) | undefined
}

/**
 * What came back: an answer read whole, an answer over the cap (the rest
 * not read), or no answer (unreachable, refused redirect, aborted). The
 * thrown error is never kept: it may quote the request.
 */
export type AiGatewayExchange =
  | { kind: "answered"; status: number; headers: Headers; body: Buffer }
  | { kind: "too_large"; status: number }
  | { kind: "failed"; aborted: boolean }

/** The answer's bytes, at most `limit`; null past it (the rest is not read). */
async function readCappedBytes(response: Response, limit: number): Promise<Buffer | null> {
  const reader = response.body?.getReader()
  if (!reader) {
    return Buffer.alloc(0)
  }
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    size += value.byteLength
    if (size > limit) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export async function postToAiGateway(post: AiGatewayPost): Promise<AiGatewayExchange> {
  const { endpoint } = post
  const signed = signRequest({
    method: "POST",
    path: post.path,
    tenantId: endpoint.tenantId,
    body: post.body,
    signer: endpoint.signer,
    ...(post.now ? { now: post.now() } : {}),
  })
  const signal = AbortSignal.any([AbortSignal.timeout(post.timeoutMs), post.signal])
  let response: Response
  try {
    response = await (post.fetch ?? fetch)(`${endpoint.url}${post.path}`, {
      method: "POST",
      headers: { ...post.headers, ...signed },
      body: typeof post.body === "string" ? post.body : new Uint8Array(post.body),
      redirect: "error",
      signal,
    })
  } catch {
    return { kind: "failed", aborted: signal.aborted }
  }
  let body: Buffer | null
  try {
    body = await readCappedBytes(response, post.maxResponseBytes)
  } catch {
    return { kind: "failed", aborted: signal.aborted }
  }
  return body === null
    ? { kind: "too_large", status: response.status }
    : { kind: "answered", status: response.status, headers: response.headers, body }
}
