import { randomUUID } from "node:crypto"
import { createServer } from "node:http"
import type { IncomingHttpHeaders, Server, ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { signRequest } from "@qticaret/server-kit"
import { AI_CREDITS_PATHS } from "@qticaret/types/control-plane"
import { FAKE_URL_ENV } from "../../src/lib/ai-gateway/target"
import type { AiShop } from "./ai-shops"
import { anyStatus } from "./staff"
import type { HttpClient } from "./staff"

/**
 * A fake AI provider on the loopback for the gateway's tests (never a real
 * service): the fake target's address under NODE_ENV=test. It records
 * each request as it arrived (path, headers, exact bytes) and answers as
 * the test says: a status, headers and a body, after a wait, or with the
 * connection dropped.
 */

export interface SeenRequest {
  path: string
  headers: IncomingHttpHeaders
  body: Buffer
}

export interface FakeAnswer {
  status?: number
  headers?: Record<string, string>
  body?: string | Buffer
  /** Milliseconds before answering. */
  delayMs?: number
  /** The connection dropped before any answer. */
  drop?: boolean
}

export const CALLS = AI_CREDITS_PATHS.calls

export interface FakeProvider {
  seen: SeenRequest[]
  /** The next answers, in order; the last one repeats. */
  answer: (...answers: FakeAnswer[]) => void
  close: () => Promise<void>
}

/** A chat completion as the OpenAI-compatible services answer it. */
export const chatAnswer = (
  text = "Başlık",
  usage = { prompt_tokens: 120, completion_tokens: 30 }
) =>
  JSON.stringify({
    id: "cmpl-1",
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage,
  })

function reply(res: ServerResponse, answer: FakeAnswer): void {
  if (answer.drop === true) {
    res.socket?.destroy()
    return
  }
  res.writeHead(answer.status ?? 200, {
    "content-type": "application/json",
    ...answer.headers,
  })
  res.end(answer.body ?? chatAnswer())
}

export async function startFakeProvider(): Promise<FakeProvider> {
  const seen: SeenRequest[] = []
  let queue: FakeAnswer[] = [{}]
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => {
      seen.push({ path: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks) })
      const answer = (queue.length > 1 ? queue.shift() : queue[0]) ?? {}
      if (answer.delayMs !== undefined) {
        setTimeout(() => {
          reply(res, answer)
        }, answer.delayMs)
      } else {
        reply(res, answer)
      }
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo
  process.env[FAKE_URL_ENV] = `http://127.0.0.1:${String(port)}/`
  return {
    seen,
    answer: (...answers) => {
      queue = answers.length > 0 ? answers : [{}]
    },
    close: async () => {
      Reflect.deleteProperty(process.env, FAKE_URL_ENV)
      server.closeAllConnections()
      await new Promise<void>((resolve) =>
        server.close(() => {
          resolve()
        })
      )
    },
  }
}

export interface CallOptions {
  task?: string
  capability?: string
  service?: string
  operation?: string
  contentType?: string
  /** The query as signed and sent, written out (a broken or repeated value). */
  query?: string
  /** The query sent in place of the signed one (changed after signing). */
  sentQuery?: string
  /** The bytes sent in place of the signed ones (changed after signing). */
  sentBody?: string | Buffer
  /** Headers added after signing (a shop's own that must never reach the provider). */
  extra?: Record<string, string>
  /** Signed as this shop's id but with `shop`'s key (a forgery). */
  tenantId?: string
  /** No signature at all. */
  unsigned?: boolean
  /** The shop hangs up after this long. */
  timeoutMs?: number
}

export interface CallReply {
  status: number
  data: Buffer
  headers: Record<string, string | string[] | undefined>
}

/** The call's query in the contract's order; the values as given (a test may break one). */
export const callQuery = (options: CallOptions = {}): string =>
  new URLSearchParams([
    ["task", options.task ?? "seo_title"],
    ["capability", options.capability ?? "text"],
    ["service", options.service ?? "fake"],
    ["operation", options.operation ?? randomUUID()],
  ]).toString()

// No query, no `?`: the client would drop a lone one from what it sends
const targetOf = (query: string): string => (query === "" ? CALLS : `${CALLS}?${query}`)

/** What `callAs` sends: the target, the bytes and the headers, signed by `shop`. */
export function signedCall(
  shop: AiShop,
  body: string | Buffer,
  options: CallOptions = {}
): { path: string; bytes: Buffer; headers: Record<string, string> } {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body)
  const query = options.query ?? callQuery(options)
  const signed = options.unsigned
    ? {}
    : signRequest({
        method: "POST",
        path: targetOf(query),
        tenantId: options.tenantId ?? shop.id,
        body: bytes,
        signer: shop.signer,
      })
  const sent = options.sentBody
  return {
    path: targetOf(options.sentQuery ?? query),
    bytes: sent === undefined ? bytes : Buffer.isBuffer(sent) ? sent : Buffer.from(sent),
    headers: {
      ...signed,
      "content-type": options.contentType ?? "application/json",
      ...options.extra,
    },
  }
}

/** Sends a call as `signedCall` built it (twice, for a replay). */
export function sendCall(
  http: HttpClient,
  call: { path: string; bytes: Buffer; headers: Record<string, string> },
  timeoutMs?: number
): Promise<CallReply> {
  return http.post(call.path, call.bytes, {
    ...anyStatus,
    ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }),
    responseType: "arraybuffer",
    // The bytes as they are: axios must not turn them into anything else
    transformRequest: [(data: unknown) => data],
    transformResponse: [(data: unknown) => data],
    headers: call.headers,
  })
}

/** `POST /ai/calls?…` with these exact bytes, signed by `shop` over its target and bytes. */
export function callAs(
  http: HttpClient,
  shop: AiShop,
  body: string | Buffer,
  options: CallOptions = {}
): Promise<CallReply> {
  return sendCall(http, signedCall(shop, body, options), options.timeoutMs)
}

/** A chat body as the shop's connector builds it. */
export const chatBody = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    model: "fake-text",
    messages: [
      { role: "system", content: "Bir SEO başlığı yaz." },
      { role: "user", content: "Ürün: Şam çeliği bıçak" },
    ],
    stream: false,
    max_tokens: 360,
    ...extra,
  })

export const jsonOf = (reply: CallReply): Record<string, unknown> =>
  JSON.parse(Buffer.from(reply.data).toString("utf8")) as Record<string, unknown>
