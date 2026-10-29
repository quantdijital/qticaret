import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"

/**
 * A stand-in for Meta's Conversions API and GA4's Measurement Protocol
 * (F10.9): `POST /v26.0/:pixel/events` and `GET /v26.0/:pixel` with the
 * token in the query, Meta's codes for a token (190) or pixel (100) it
 * does not know; `POST /mp/collect`, answered 204 whatever it holds, as
 * GA4 does. It keeps what it was sent.
 */

export interface FakeConversions {
  url: string
  meta: { pixelId: string; accessToken: string }
  ga4: { measurementId: string; apiSecret: string }
  /** Events Meta took, each with the pixel it went to and the test code. */
  metaEvents: (Record<string, unknown> & { pixel: string; test_event_code?: string })[]
  /** GA4 requests, with whether their secret was the stream's own. */
  ga4Requests: { body: Record<string, unknown>; valid: boolean }[]
  close: () => Promise<void>
}

const random = (bytes = 16) => randomBytes(bytes).toString("base64url")

export async function startFakeConversions(): Promise<FakeConversions> {
  const meta = {
    pixelId: String(100_000_000_000 + Math.floor(Math.random() * 800_000_000_000)),
    accessToken: `EAA${random(24)}`,
  }
  const ga4 = {
    measurementId: `G-${random(6)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "X")}`,
    apiSecret: random(12),
  }
  const metaEvents: FakeConversions["metaEvents"] = []
  const ga4Requests: FakeConversions["ga4Requests"] = []
  const sockets = new Set<Socket>()

  const server = createServer((req, res) => {
    let body = ""
    req.on("data", (chunk: Buffer) => (body += chunk.toString()))
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://fake")
      const json = (status: number, answer: unknown) => {
        res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(answer))
      }
      if (req.method === "POST" && url.pathname === "/mp/collect") {
        ga4Requests.push({
          body: JSON.parse(body || "{}") as Record<string, unknown>,
          valid:
            url.searchParams.get("measurement_id") === ga4.measurementId &&
            url.searchParams.get("api_secret") === ga4.apiSecret,
        })
        res.writeHead(204).end()
        return
      }
      const pixel = /^\/v26\.0\/(\d+)(\/events)?$/.exec(url.pathname)
      if (!pixel) {
        json(404, { error: { code: 803, message: "Unknown path" } })
        return
      }
      if (url.searchParams.get("access_token") !== meta.accessToken) {
        json(400, { error: { code: 190, message: "Invalid OAuth access token." } })
        return
      }
      if (pixel[1] !== meta.pixelId) {
        json(400, { error: { code: 100, message: "Unsupported get request." } })
        return
      }
      if (req.method === "GET" && !pixel[2]) {
        json(200, { id: meta.pixelId })
        return
      }
      if (req.method === "POST" && pixel[2]) {
        const order = JSON.parse(body) as {
          data?: Record<string, unknown>[]
          test_event_code?: string
        }
        for (const event of order.data ?? []) {
          metaEvents.push({
            ...event,
            pixel: meta.pixelId,
            ...(order.test_event_code ? { test_event_code: order.test_event_code } : {}),
          })
        }
        json(200, { events_received: order.data?.length ?? 0, fbtrace_id: random(8) })
        return
      }
      json(404, { error: { code: 803, message: "Unknown path" } })
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    meta,
    ga4,
    metaEvents,
    ga4Requests,
    close: async () => {
      for (const socket of sockets) {
        socket.destroy()
      }
      await new Promise<void>((resolve) =>
        server.close(() => {
          resolve()
        })
      )
    },
  }
}
