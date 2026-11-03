import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { serveTracking } from "../carrier/page"
import type { TrackingPlace } from "../carrier/page"
import { stateFileFor, stateStore } from "../carrier/tracking"
import type { AdvanceMode } from "../carrier/tracking"
import { field, operation, parcelError } from "./rules"
import { TRACKING_STEPS, moveShipment, shipmentOf, yurticiTracking } from "./shipments"
import type { FakeYurticiShipment } from "./shipments"

/**
 * A stand-in for Yurtiçi Kargo's shipping order service (adr/0035): the
 * JAX-WS operations the platform calls, answered in the shapes Yurtiçi's
 * "Web Servis Giden Kargo Teknik Döküman V3" gives (docs/entegrasyonlar/
 * yurtici.md), its parcel rules in `./rules`. Parcels are kept by our cargo
 * key and by the login that opened them: the shop's account and its
 * separate door account each see only their own. A parcel moves on a step
 * on each tracking read (`advance: "on-read"`, the tests' default) or only
 * from the buttons of Yurtiçi's tracking page, served at `/takip/<docId>`
 * (`"manual"`). A wrong login is a SOAP fault (HTTP 500), as JAX-WS
 * answers it (the document does not say).
 */

export { TRACKING_STEPS } from "./shipments"
export type { FakeYurticiShipment } from "./shipments"

export interface FakeYurticiLogin {
  username: string
  password: string
}

export interface FakeYurticiAccounts {
  main: FakeYurticiLogin
  /** The account for parcels paid at the door. */
  cod: FakeYurticiLogin
}

export interface FakeYurticiOptions {
  port?: number
  advance?: AdvanceMode
  /** Where the shop's parcels leave from, for the tracking page. */
  origin?: TrackingPlace
  /** Keeps the parcels in the OS temp folder between runs (a developer's fake). */
  persist?: boolean
}

export interface FakeYurtici {
  url: string
  accounts: FakeYurticiAccounts
  shipments: Map<string, FakeYurticiShipment>
  requests: { operation: string; body: string }[]
  /** Pins a parcel where it stands: reads no longer move it on. */
  hold: (cargoKey: string) => void
  /**
   * The next answer to an operation instead of the usual one: a refusal
   * with this code, `lost` for a parcel opened whose answer never comes, or
   * `fault:<code>` for a service exception (HTTP 500) with that code.
   */
  queue: (operation: string, errCode: string) => void
  close: () => Promise<void>
}

const login = (prefix: string): FakeYurticiLogin => ({
  username: `${prefix}-${randomBytes(4).toString("hex")}`,
  password: randomBytes(12).toString("hex"),
})

/** Random logins each run: no fixed secret a scanner could take for a real one (docs/04). */
export const fakeYurticiAccounts = (): FakeYurticiAccounts => ({
  main: login("yurtici"),
  cod: login("yurtici-tahsilat"),
})

const NS = "http://yurticikargo.com.tr/ShippingOrderDispatcherServices"

const envelope = (inner: string) =>
  `<?xml version="1.0" ?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body>${inner}</S:Body></S:Envelope>`

const answer = (operation: string, inner: string) =>
  envelope(`<ns2:${operation}Response xmlns:ns2="${NS}">${inner}</ns2:${operation}Response>`)

const fault = (code: string, text: string) =>
  envelope(
    `<S:Fault><faultcode>S:Server</faultcode><faultstring>${text}</faultstring><detail><ns2:YurticikargoWSException xmlns:ns2="http://yurticikargo.com.tr/WSExceptions/"><errorCode>${code}</errorCode><errText>${text}</errText></ns2:YurticikargoWSException></detail></S:Fault>`
  )

const FAULT = fault("936", "Kullanıcı adı veya şifre hatalı")

/** The document's error line for a key the login does not have: no cargo key on it. */
const notFound = (user: string, cargoKey: string) =>
  `<errCode>82519</errCode><errMessage>${user}  kullanıcısına ait  ${cargoKey} kargo anahtarı bulunmamaktadır.</errMessage><jobId>0</jobId>`

export async function startFakeYurtici(
  accounts: FakeYurticiAccounts = fakeYurticiAccounts(),
  options: FakeYurticiOptions = {}
): Promise<FakeYurtici> {
  const shipments = new Map<string, FakeYurticiShipment>()
  const requests: FakeYurtici["requests"] = []
  const held = new Set<string>()
  const queued = new Map<string, string[]>()
  const sockets = new Set<Socket>()
  let store = stateStore<{ shipments: [string, FakeYurticiShipment][] }>(null)
  const save = () => {
    store.save({ shipments: [...shipments.entries()] })
  }
  const numbered = (docId: string) =>
    [...shipments.values()].some((shipment) => shipment.docId === docId)

  const accountOf = (body: string): "main" | "cod" | null => {
    const user = field(body, "wsUserName")
    const password = field(body, "wsPassword")
    for (const name of ["main", "cod"] as const) {
      if (user === accounts[name].username && password === accounts[name].password) {
        return name
      }
    }
    return null
  }

  const create = (body: string, account: "main" | "cod", forced: string | undefined) => {
    const cargoKey = field(body, "cargoKey")
    // "lost": opened, but the answer never reaches the caller
    const lost = forced === "lost"
    const errCode =
      (lost ? undefined : forced) ?? (shipments.has(cargoKey) ? "60020" : parcelError(body))
    if (errCode === "0") {
      shipments.set(cargoKey, shipmentOf(body, account, numbered))
    }
    if (lost) {
      return { status: 500, text: envelope("") }
    }
    const ok = errCode === "0"
    return {
      status: 200,
      text: answer(
        "createShipment",
        `<ShippingOrderResultVO><outFlag>${ok ? "0" : "1"}</outFlag><outResult>${ok ? "Başarılı." : "Hata Oluştu."}</outResult><count>1</count><jobId>${ok ? "419085" : "0"}</jobId><shippingOrderDetailVO><cargoKey>${cargoKey}</cargoKey><errCode>${errCode}</errCode><errMessage>${ok ? "Başarılı." : "Hata"}</errMessage><invoiceKey>${field(body, "invoiceKey")}</invoiceKey></shippingOrderDetailVO></ShippingOrderResultVO>`
      ),
    }
  }

  const query = (body: string, account: "main" | "cod", forced: string | undefined) => {
    const cargoKey = field(body, "keys")
    const shipment = shipments.get(cargoKey)
    let line = forced
      ? `<cargoKey>${cargoKey}</cargoKey><errCode>${forced}</errCode><errMessage>Hata</errMessage>`
      : notFound(field(body, "wsUserName"), cargoKey)
    if (shipment?.account === account && !forced) {
      const head = `<cargoKey>${cargoKey}</cargoKey><invoiceKey>${cargoKey}</invoiceKey><jobId>419085</jobId><docId>${shipment.docId}</docId><errCode>0</errCode>`
      if (shipment.canceled) {
        line = `${head}${operation("CNL")}`
      } else {
        const onRead = (options.advance ?? "on-read") === "on-read"
        if (onRead && !held.has(cargoKey) && !shipment.returnRequested) {
          moveShipment(shipment, shipment.step + 1)
        }
        const step = TRACKING_STEPS[shipment.step]
        // The link comes with `onlyTracking` only (the document), and on http as it shows it
        const link =
          field(body, "onlyTracking") === "true"
            ? `<trackingUrl>http://selfservis.yurticikargo.com/reports/SSWDocumentDetail.aspx?DocId=${shipment.docId}</trackingUrl>`
            : ""
        const back = shipment.returnRequested
          ? "<rejectStatus>0</rejectStatus><rejectStatusExplanation>İade isteği yapıldı</rejectStatusExplanation>"
          : ""
        line = step
          ? `${head}${operation(shipment.returnRequested ? "RETURN" : step.operation)}<shippingDeliveryItemDetailVO><cargoKey>${cargoKey}</cargoKey><docId>${shipment.docId}</docId><cargoEventExplanation>${step.event}</cargoEventExplanation><cargoReasonExplanation>Sorun Yok</cargoReasonExplanation>${back}<returnStatus>0</returnStatus><returnStatusExplanation>Teslim edilmedi ve geri dönüş faturası kesilmedi.</returnStatusExplanation>${link}</shippingDeliveryItemDetailVO>`
          : `${head}${operation("NOP")}`
      }
    }
    return {
      status: 200,
      text: answer(
        "queryShipment",
        `<ShippingDeliveryVO><outFlag>0</outFlag><outResult>Başarılı.</outResult><count>1</count><senderCustId>1</senderCustId><shippingDeliveryDetailVO>${line}</shippingDeliveryDetailVO></ShippingDeliveryVO>`
      ),
    }
  }

  const cancel = (body: string, account: "main" | "cod", forced: string | undefined) => {
    const cargoKey = field(body, "cargoKeys")
    const shipment = shipments.get(cargoKey)
    const mine = shipment?.account === account ? shipment : undefined
    const head = `<cargoKey>${cargoKey}</cargoKey><docId>${mine && mine.step >= 0 ? mine.docId : "0"}</docId><invoiceKey>${cargoKey}</invoiceKey><jobId>419100</jobId>`
    let failed: string | null = forced ?? null
    let line = ""
    if (!failed && !mine) {
      failed = "82519"
    } else if (!failed && mine?.canceled) {
      // A repeat: the document's answer is this code under outFlag 1
      failed = "82520"
    } else if (mine && !failed) {
      // Before its document is issued it is kept from leaving; after, a return request
      const step = TRACKING_STEPS[mine.step]
      if (!step || step.operation === "ISR") {
        mine.canceled = true
        line = operation("CNL")
      } else if (step.operation === "IND") {
        mine.returnRequested = true
        line = operation("RETURN")
      } else {
        line = operation("DLV")
      }
    }
    const detail = failed
      ? `${head}<errCode>${failed}</errCode><errMessage>Hata</errMessage>`
      : `${head}${line}`
    return {
      status: 200,
      text: answer(
        "cancelShipment",
        `<ShippingOrderResultVO><outFlag>${failed ? "1" : "0"}</outFlag><outResult>${failed ? "Hata Oluştu." : "Başarılı."}</outResult><count>1</count><senderCustId>1</senderCustId><shippingCancelDetailVO>${detail}</shippingCancelDetailVO></ShippingOrderResultVO>`
      ),
    }
  }

  const reply = (name: string, body: string): { status: number; text: string } => {
    const account = accountOf(body)
    if (!account) {
      return { status: 500, text: FAULT }
    }
    const forced = queued.get(name)?.shift()
    if (forced?.startsWith("fault:")) {
      return { status: 500, text: fault(forced.slice("fault:".length), "Hata") }
    }
    switch (name) {
      case "createShipment":
        return create(body, account, forced)
      case "queryShipment":
        return query(body, account, forced)
      case "cancelShipment":
        return cancel(body, account, forced)
      default:
        return { status: 500, text: FAULT }
    }
  }

  const tracking = yurticiTracking(shipments, options.origin ?? null, save)
  const server = createServer((req, res) => {
    let body = ""
    req.on("data", (chunk: Buffer) => (body += chunk.toString()))
    req.on("end", () => {
      if (serveTracking(req, res, body, tracking)) {
        return
      }
      const name = /<soap:Body>\s*<(?:\w+:)?(\w+)/.exec(body)?.[1] ?? ""
      requests.push({ operation: name, body })
      const { status, text } = reply(name, body)
      save()
      res.writeHead(status, { "content-type": "text/xml; charset=utf-8" }).end(text)
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo
  if (options.persist) {
    store = stateStore(stateFileFor("yurtici", address.port))
    for (const [key, shipment] of store.load()?.shipments ?? []) {
      shipments.set(key, shipment)
    }
  }

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    accounts,
    shipments,
    requests,
    hold: (cargoKey) => {
      held.add(cargoKey)
    },
    queue: (name, errCode) => {
      queued.set(name, [...(queued.get(name) ?? []), errCode])
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
