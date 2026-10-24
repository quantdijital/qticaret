import { createServer } from "node:http"
import type { IncomingMessage, Server, ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { z } from "@medusajs/framework/zod"
import type { LogFields, StructuredLogger } from "../../logging"
import { createStructuredLogger } from "../../logging"
import { captureLogger } from "../../logging/__tests__/capture"
import { createHttpClient } from "../http-client"
import type { HttpClientOptions } from "../http-client"

export type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void

export interface Harness {
  baseUrl: () => string
  requests: { method: string; url: string; headers: IncomingMessage["headers"]; body: string }[]
  setHandler: (handler: Handler) => void
  sleeps: number[]
}

/** A local provider stand-in; call inside a describe block. */
export function useProvider(): Harness {
  let server: Server
  let handler: Handler = (_req, res) => res.end("{}")
  const harness: Harness = {
    baseUrl: () => `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    requests: [],
    setHandler: (next) => {
      handler = next
    },
    sleeps: [],
  }
  beforeAll(async () => {
    server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on("data", (chunk: Buffer) => chunks.push(chunk))
      req.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8")
        harness.requests.push({
          method: req.method ?? "",
          url: req.url ?? "",
          headers: req.headers,
          body,
        })
        handler(req, res, body)
      })
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  })
  afterAll(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve) =>
      server.close(() => {
        resolve()
      })
    )
  })
  beforeEach(() => {
    harness.requests.length = 0
    harness.sleeps.length = 0
    handler = (_req, res) => res.end("{}")
  })
  return harness
}

export const json =
  (status: number, body: unknown, headers: Record<string, string> = {}): Handler =>
  (_req, res) => {
    res
      .writeHead(status, { "content-type": "application/json", ...headers })
      .end(JSON.stringify(body))
  }

export const sequence = (...handlers: Handler[]): Handler => {
  let index = 0
  return (req, res, body) => {
    const next = handlers[Math.min(index, handlers.length - 1)]
    index += 1
    next?.(req, res, body)
  }
}

export const Item = z.object({ id: z.string() })

/** A client against the harness with a captured logger and recorded sleeps. */
export function clientFor(harness: Harness, extra: Partial<HttpClientOptions> = {}) {
  const captured = captureLogger()
  const http = createHttpClient({
    provider: "acme",
    baseUrl: harness.baseUrl(),
    logger: createStructuredLogger(captured.base),
    sleep: (ms) => {
      harness.sleeps.push(ms)
      return Promise.resolve()
    },
    random: () => 0.5,
    ...extra,
  })
  return { http, captured }
}

/** A logger that records the raw fields it is given, before any redaction. */
export function spyLogger(): { logger: StructuredLogger; calls: LogFields[] } {
  const calls: LogFields[] = []
  const record = (fields: LogFields) => {
    calls.push(fields)
  }
  return { logger: { error: record, warn: record, info: record, debug: record }, calls }
}

export async function errorOf(run: Promise<unknown>): Promise<unknown> {
  try {
    await run
  } catch (error) {
    return error
  }
  throw new Error("expected the request to fail")
}

/** A local port nothing listens on (port 1 would be refused by fetch itself as a bad port). */
export async function closedPort(): Promise<number> {
  const probe = createServer()
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve))
  const port = (probe.address() as AddressInfo).port
  await new Promise<void>((resolve) =>
    probe.close(() => {
      resolve()
    })
  )
  return port
}
