import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { serveTracking } from "../carrier/page"
import type { TrackingPlace } from "../carrier/page"
import { stateFileFor, stateStore, trackingNumber } from "../carrier/tracking"
import type { AdvanceMode } from "../carrier/tracking"
import { fakeCities, fakeDistricts } from "./places"
import { answerOf } from "./routes"
import type { FakeDhlEcomState } from "./routes"
import { dhlEcomTracking } from "./shipments"
import type { FakeDhlEcomOrder } from "./shipments"

/**
 * A stand-in for DHL eCommerce Türkiye's REST API (formerly MNG Kargo;
 * docs/entegrasyonlar/dhlecommerce.md): the calls the platform makes, at
 * their paths under `/mngapi/api`, answered in the shapes the open source
 * clients report (one object wrapped in an array, refusals as
 * `{error: {code, message, description}}` under HTTP 500). The gateway
 * checks the platform's app on every call and the shop's JWT on all but
 * the il/ilçe lists; a JWT lives `tokenTtlMs` (eight hours unless set) or
 * until `expireTokens`. An order whose recipient was not registered first
 * (`createRecipient`) gets 20001 ("VARIŞ ŞUBESİ BULUNAMADI") on its
 * barcode, as DHL's own does. A parcel moves on a step on each status read
 * (`advance: "on-read"`, the tests' default) or only from the buttons of
 * the tracking page at `/takip/<shipmentId>` (`"manual"`).
 */

export { TRACKING_STEPS } from "./shipments"
export type { FakeDhlEcomOrder } from "./shipments"

export interface FakeDhlEcomApp {
  clientId: string
  clientSecret: string
}

export interface FakeDhlEcomAccount {
  customerNumber: string
  password: string
}

export interface FakeDhlEcomOptions {
  port?: number
  advance?: AdvanceMode
  origin?: TrackingPlace
  /** Keeps the orders in the OS temp folder between runs (a developer's fake). */
  persist?: boolean
  tokenTtlMs?: number
}

export interface FakeDhlEcom {
  url: string
  app: FakeDhlEcomApp
  account: FakeDhlEcomAccount
  orders: Map<string, FakeDhlEcomOrder>
  /** Recipients registered, by their address key. */
  recipients: Set<string>
  requests: { method: string; path: string; body: unknown }[]
  /** Pins an order where it stands: reads no longer move it on. */
  hold: (referenceId: string) => void
  /**
   * The next answer to an operation (`createOrder`, `createbarcode`,
   * `cancelshipment`, `cancelorder`, `getshipmentstatus`, `token`) instead
   * of the usual one: a refusal with this DHL code, or `lost` for a call
   * done whose answer never comes (HTTP 500, no body).
   */
  queue: (operation: string, code: string) => void
  /** Every JWT given so far is refused from now on, as after its eight hours. */
  expireTokens: () => void
  /** API products the app has no subscription to (`createOrder` → Standard Command). */
  unsubscribe: (product: "identity" | "standard" | "barcode" | "plus" | "query" | "cbs") => void
  close: () => Promise<void>
}

const secret = (prefix: string) => `${prefix}-${randomBytes(8).toString("hex")}`

/** Random app keys and login each run: no fixed secret a scanner could take for a real one (docs/04). */
export const fakeDhlEcomApp = (): FakeDhlEcomApp => ({
  clientId: secret("dhl-uygulama"),
  clientSecret: secret("dhl-sir"),
})
export const fakeDhlEcomAccount = (): FakeDhlEcomAccount => ({
  customerNumber: String(100_000_000 + Math.floor(Math.random() * 800_000_000)),
  password: secret("dhl-sifre"),
})

export async function startFakeDhlEcom(
  app: FakeDhlEcomApp = fakeDhlEcomApp(),
  account: FakeDhlEcomAccount = fakeDhlEcomAccount(),
  options: FakeDhlEcomOptions = {}
): Promise<FakeDhlEcom> {
  const sockets = new Set<Socket>()
  const state: FakeDhlEcomState = {
    app,
    account,
    orders: new Map(),
    recipients: new Set(),
    tokens: new Map(),
    held: new Set(),
    queued: new Map(),
    unsubscribed: new Set(),
    requests: [],
    advance: options.advance ?? "on-read",
    tokenTtlMs: options.tokenTtlMs ?? 8 * 60 * 60 * 1000,
    cities: fakeCities(),
    districts: fakeDistricts,
    shipmentNumber: () =>
      trackingNumber({ digits: 12 }, (candidate) =>
        [...state.orders.values()].some((order) => order.shipmentId === candidate)
      ),
  }
  let store = stateStore<{ orders: [string, FakeDhlEcomOrder][]; recipients: string[] }>(null)
  const save = () => {
    store.save({ orders: [...state.orders.entries()], recipients: [...state.recipients] })
  }
  const tracking = dhlEcomTracking(state.orders, options.origin ?? null, save)

  const server = createServer((req, res) => {
    let body = ""
    req.on("data", (chunk: Buffer) => (body += chunk.toString()))
    req.on("end", () => {
      if (serveTracking(req, res, body, tracking)) {
        return
      }
      const { status, json } = answerOf(state, req, body)
      save()
      if (json === undefined) {
        res.writeHead(status).end()
        return
      }
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(json))
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo
  if (options.persist) {
    store = stateStore(stateFileFor("dhlecommerce", address.port))
    const saved = store.load()
    for (const [key, order] of saved?.orders ?? []) {
      state.orders.set(key, order)
    }
    for (const key of saved?.recipients ?? []) {
      state.recipients.add(key)
    }
  }

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    app,
    account,
    orders: state.orders,
    recipients: state.recipients,
    requests: state.requests,
    hold: (referenceId) => {
      state.held.add(referenceId)
    },
    queue: (operation, code) => {
      state.queued.set(operation, [...(state.queued.get(operation) ?? []), code])
    },
    expireTokens: () => {
      state.tokens.clear()
    },
    unsubscribe: (product) => {
      state.unsubscribed.add(product)
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
