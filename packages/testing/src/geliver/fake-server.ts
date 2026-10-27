import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { createAddresses } from "./addresses"
import type { FakeAddress } from "./addresses"
import { priceList } from "./prices"
import { createShipments } from "./shipments"
import type { FakeShipment } from "./shipments"
import { failed, matchRoute } from "./routes"
import type { Handler, Reply } from "./routes"

/**
 * A local stand-in for Geliver's API (docs/07: tests never call the real
 * provider; adr/0031). Served under `/api/v1` like Geliver itself, with a
 * Bearer token: another token is a 401. Answers in Geliver's envelope
 * (`{ result, data }`): addresses, the price list, shipments with their
 * offers, accepting one (the label), cancelling, and the label PDF.
 */

export type { FakeAddress } from "./addresses"
export type { FakeShipment } from "./shipments"

/** An answer queued for the next request to a route: a reply, a stall, or a dropped connection. */
export type FakeGeliverAnswer = Reply | { hang: true } | { drop: true }

export interface FakeGeliver {
  /** The base URL the backend takes as `GELIVER_BASE_URL`. */
  url: string
  token: string
  requests: { method: string; path: string; body: Record<string, unknown> }[]
  addresses: Map<string, FakeAddress>
  shipments: Map<string, FakeShipment>
  /** Moves a test shipment one step on, as a read at Geliver does. */
  advance: (shipmentId: string) => void
  /** The shipment as Geliver answers it (a notification's body carries the same). */
  view: (shipmentId: string) => unknown
  /** Queues an answer for the next `METHOD /path` (the path as requested). */
  queue: (route: string, answer: FakeGeliverAnswer) => void
  close: () => Promise<void>
}

const BASE = "/api/v1"

/** A token for the fake: random each run, so none is ever written into a test. */
export const fakeGeliverToken = (): string => `gelistirme-${randomBytes(16).toString("hex")}`

async function readText(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString("utf8")
}

const send = (res: ServerResponse, reply: Reply) => {
  if (reply.bytes) {
    res.writeHead(reply.status ?? 200, { "content-type": reply.bytes.type })
    res.end(reply.bytes.data)
    return
  }
  res.writeHead(reply.status ?? 200, { "content-type": "application/json" })
  res.end(JSON.stringify(reply.body))
}

/** Starts the fake on a local port: a free one, or `port` for a dev backend's GELIVER_BASE_URL. */
export async function startFakeGeliver(
  token: string = fakeGeliverToken(),
  options: { port?: number } = {}
): Promise<FakeGeliver> {
  const requests: FakeGeliver["requests"] = []
  const queued = new Map<string, FakeGeliverAnswer[]>()
  const sockets = new Set<Socket>()
  const addresses = createAddresses()
  let origin = ""
  const shipments = createShipments(() => origin)
  const routes: Record<string, Handler> = {
    ...addresses.routes,
    ...shipments.routes,
    "GET /priceList": priceList,
  }

  const answer = (req: IncomingMessage, path: string, query: URLSearchParams, text: string) => {
    if (req.headers.authorization !== `Bearer ${token}`) {
      return failed(401, "UNAUTHORIZED", "invalid token")
    }
    const route = matchRoute(routes, req.method ?? "GET", path)
    if (!route) {
      return failed(404, "NOT_FOUND", "no such route")
    }
    const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>
    return route.handler({ body, query, params: route.params })
  }

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://fake")
      // Labels sit outside the API and need no token, like Geliver's label links
      const label = /^\/labels\/([^/]+)\.pdf$/.exec(url.pathname)?.[1]
      if (label && req.method === "GET") {
        send(res, shipments.label(label))
        return
      }
      const path = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : url.pathname
      const text = await readText(req)
      requests.push({
        method: req.method ?? "GET",
        path,
        body: (text ? JSON.parse(text) : {}) as Record<string, unknown>,
      })
      const next = queued.get(`${req.method ?? "GET"} ${path}`)?.shift()
      if (next && "hang" in next) {
        return
      }
      if (next && "drop" in next) {
        req.socket.destroy()
        return
      }
      send(res, next ?? answer(req, path, url.searchParams, text))
    })().catch(() => {
      send(res, failed(500, "INTERNAL", "error"))
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo
  origin = `http://127.0.0.1:${String(address.port)}`

  return {
    url: `${origin}${BASE}`,
    token,
    requests,
    addresses: addresses.addresses,
    shipments: shipments.shipments,
    advance: (id) => {
      const shipment = shipments.shipments.get(id)
      if (shipment) {
        shipments.advance(shipment)
      }
    },
    view: (id) => {
      const shipment = shipments.shipments.get(id)
      return shipment ? shipments.view(shipment) : null
    },
    queue: (route, next) => {
      queued.set(route, [...(queued.get(route) ?? []), next])
    },
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
