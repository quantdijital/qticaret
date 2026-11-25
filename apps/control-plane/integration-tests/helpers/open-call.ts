import { request } from "node:http"
import type { ClientRequest, IncomingHttpHeaders } from "node:http"

/**
 * A gateway call sent by hand on its own connection (security reviews of
 * P3b, O2, N2, O1): its headers at once, its body as the test lets it come
 * (part of it, none, dripped), so what the gateway does before a body is
 * whole can be seen.
 */

export interface OpenAnswer {
  status: number
  headers: IncomingHttpHeaders
  body: string
}

export interface OpenCall {
  client: ClientRequest
  answered: Promise<OpenAnswer>
  done: () => boolean
}

export interface OpenCallOptions {
  /** Where to connect (another loopback address is another client). */
  host?: string
  /** No `content-length`: the body sent chunked. */
  chunked?: boolean
}

/** A call's first `bytes` sent, the rest never: the test writes more or hangs up. */
export function openCall(
  base: URL,
  call: { path: string; bytes: Buffer; headers: Record<string, string> },
  bytes: number,
  options: OpenCallOptions = {}
): OpenCall {
  let finished = false
  let client: ClientRequest | undefined
  const length = options.chunked ? {} : { "content-length": String(call.bytes.length) }
  const answered = new Promise<OpenAnswer>((resolve) => {
    client = request(
      {
        host: options.host ?? base.hostname,
        port: base.port,
        path: call.path,
        method: "POST",
        agent: false,
        headers: { ...call.headers, ...length },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => chunks.push(chunk))
        res.on("end", () => {
          finished = true
          const body = Buffer.concat(chunks).toString("utf8")
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body })
        })
      }
    )
    // Destroyed by the test (or the server): its error is the point
    client.on("error", () => undefined)
    if (bytes > 0) {
      client.write(call.bytes.subarray(0, bytes))
    } else {
      client.flushHeaders()
    }
  })
  if (client === undefined) {
    throw new Error("no request")
  }
  return { client, answered, done: () => finished }
}

/** Waits for `done` (the server's own count), at most 10 s. */
export async function until(done: () => boolean): Promise<void> {
  for (let tries = 0; tries < 200 && !done(); tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  expect(done()).toBe(true)
}

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
