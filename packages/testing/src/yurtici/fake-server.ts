import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"

/**
 * A stand-in for Yurtiçi Kargo's shipping order service (adr/0035): the
 * JAX-WS operations the platform calls, answered in the shapes the
 * service's description (WSDL) gives. Parcels are kept by our cargo key
 * and by the login that opened them: the shop's account and its separate
 * door account each see only their own. A parcel's tracking moves one
 * step on each read until delivered. A wrong login is a SOAP fault (HTTP
 * 500), as JAX-WS answers it.
 */

export interface FakeYurticiLogin {
  username: string
  password: string
}

export interface FakeYurticiAccounts {
  main: FakeYurticiLogin
  /** The account for parcels paid at the door. */
  cod: FakeYurticiLogin
}

export interface FakeYurticiShipment {
  cargoKey: string
  /** Which login opened it. */
  account: "main" | "cod"
  receiverName: string
  city: string
  town: string
  /** `ttInvoiceAmount` as sent; empty when nothing is collected. */
  codAmount: string
  codDocumentId: string
  docId: string
  /** Steps of `TRACKING_STEPS` read so far; -1 before the first. */
  step: number
  canceled: boolean
}

/** What Yurtiçi says of a parcel, read by read: its operation code and the last event. */
export const TRACKING_STEPS = [
  { code: 2, status: "ISR", event: "Kargo kabul edildi" },
  { code: 1, status: "IND", event: "Transfer merkezinde" },
  { code: 1, status: "IND", event: "Dağıtıma çıkarıldı" },
  { code: 5, status: "DLV", event: "Teslim edildi" },
] as const

export interface FakeYurtici {
  url: string
  accounts: FakeYurticiAccounts
  shipments: Map<string, FakeYurticiShipment>
  requests: { operation: string; body: string }[]
  /** Pins a parcel where it stands: reads no longer move it on. */
  hold: (cargoKey: string) => void
  /**
   * The next answer to an operation instead of the usual one: a refusal
   * with this code, or `lost` for a parcel opened whose answer never comes.
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
  main: login("sahte"),
  cod: login("sahte-tahsilat"),
})

const field = (body: string, name: string): string =>
  new RegExp(`<${name}>([^<]*)</${name}>`).exec(body)?.[1] ?? ""

const NS = "http://yurticikargo.com.tr/ShippingOrderDispatcherServices"

const envelope = (inner: string) =>
  `<?xml version="1.0" ?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body>${inner}</S:Body></S:Envelope>`

const answer = (operation: string, inner: string) =>
  envelope(`<ns2:${operation}Response xmlns:ns2="${NS}">${inner}</ns2:${operation}Response>`)

const FAULT = envelope(
  `<S:Fault><faultcode>S:Server</faultcode><faultstring>Kullanıcı adı veya şifre hatalı</faultstring><detail><ns2:YurticikargoWSException xmlns:ns2="http://yurticikargo.com.tr/WSExceptions/"><errorCode>936</errorCode><errText>Kullanıcı adı veya şifre hatalı</errText></ns2:YurticikargoWSException></detail></S:Fault>`
)

export async function startFakeYurtici(
  accounts: FakeYurticiAccounts = fakeYurticiAccounts(),
  options: { port?: number } = {}
): Promise<FakeYurtici> {
  const shipments = new Map<string, FakeYurticiShipment>()
  const requests: FakeYurtici["requests"] = []
  const held = new Set<string>()
  const queued = new Map<string, string[]>()
  const sockets = new Set<Socket>()

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

  const reply = (operation: string, body: string): { status: number; text: string } => {
    const account = accountOf(body)
    if (!account) {
      return { status: 500, text: FAULT }
    }
    const forced = queued.get(operation)?.shift()
    switch (operation) {
      case "createShipment": {
        const cargoKey = field(body, "cargoKey")
        // "lost": opened, but the answer never reaches the caller
        const lost = forced === "lost"
        const errCode =
          (lost ? undefined : forced) ??
          (shipments.has(cargoKey) ? "60020" : !field(body, "receiverCustName") ? "60017" : "0")
        if (errCode === "0") {
          shipments.set(cargoKey, {
            cargoKey,
            account,
            receiverName: field(body, "receiverCustName"),
            city: field(body, "cityName"),
            town: field(body, "townName"),
            codAmount: field(body, "ttInvoiceAmount"),
            codDocumentId: field(body, "ttDocumentId"),
            docId: String(100_000_000_000 + shipments.size),
            step: -1,
            canceled: false,
          })
        }
        if (lost) {
          return { status: 500, text: envelope("") }
        }
        return {
          status: 200,
          text: answer(
            operation,
            `<ShippingOrderResultVO><count>1</count><jobId>1</jobId><outFlag>${errCode === "0" ? "0" : "1"}</outFlag><outResult>${errCode === "0" ? "Başarılı" : "Hata"}</outResult><shippingOrderDetailVO><cargoKey>${cargoKey}</cargoKey><errCode>${errCode}</errCode><invoiceKey>${field(body, "invoiceKey")}</invoiceKey></shippingOrderDetailVO></ShippingOrderResultVO>`
          ),
        }
      }
      case "queryShipment": {
        const cargoKey = field(body, "keys")
        const shipment = shipments.get(cargoKey)
        const known = shipment?.account === account && !forced
        let line = `<cargoKey>${cargoKey}</cargoKey><errCode>${forced ?? "82500"}</errCode><errMessage>Kayıt bulunamadı</errMessage>`
        if (known) {
          if (shipment.canceled) {
            line = `<cargoKey>${cargoKey}</cargoKey><errCode>0</errCode><operationCode>4</operationCode><operationMessage>Kargo iptal edilmiştir.</operationMessage><operationStatus>ISC</operationStatus>`
          } else {
            if (!held.has(cargoKey)) {
              shipment.step = Math.min(shipment.step + 1, TRACKING_STEPS.length - 1)
            }
            const step = TRACKING_STEPS[shipment.step]
            line = step
              ? `<cargoKey>${cargoKey}</cargoKey><errCode>0</errCode><operationCode>${String(step.code)}</operationCode><operationMessage>${step.event}</operationMessage><operationStatus>${step.status}</operationStatus><shippingDeliveryItemDetailVO><cargoKey>${cargoKey}</cargoKey><docId>${shipment.docId}</docId><trackingUrl>https://selfservis.yurticikargo.com/reports/SSWDocumentDetail.aspx?DocId=${shipment.docId}</trackingUrl><cargoEventExplanation>${step.event}</cargoEventExplanation></shippingDeliveryItemDetailVO>`
              : `<cargoKey>${cargoKey}</cargoKey><errCode>0</errCode><operationCode>0</operationCode><operationStatus>NOP</operationStatus>`
          }
        }
        return {
          status: 200,
          text: answer(
            operation,
            `<ShippingDeliveryVO><count>1</count><outFlag>${known ? "0" : "1"}</outFlag><outResult/><senderCustId>1</senderCustId><shippingDeliveryDetailVO>${line}</shippingDeliveryDetailVO></ShippingDeliveryVO>`
          ),
        }
      }
      case "cancelShipment": {
        const cargoKey = field(body, "cargoKeys")
        const shipment = shipments.get(cargoKey)
        const mine = shipment?.account === account ? shipment : undefined
        // Withdrawn while the branch has not taken it yet
        let errCode = forced ?? (mine && mine.step < 0 ? "0" : "82512")
        let operationCode = "0"
        if (mine?.canceled && !forced) {
          errCode = "82513"
          operationCode = "4"
        } else if (errCode === "0" && mine) {
          mine.canceled = true
        }
        return {
          status: 200,
          text: answer(
            operation,
            `<ShippingOrderResultVO><count>1</count><outFlag>${errCode === "0" ? "0" : "1"}</outFlag><outResult/><senderCustId>1</senderCustId><shippingCancelDetailVO><cargoKey>${cargoKey}</cargoKey><docId>0</docId><errCode>${errCode}</errCode><jobId>0</jobId><operationCode>${operationCode}</operationCode></shippingCancelDetailVO></ShippingOrderResultVO>`
          ),
        }
      }
      default:
        return { status: 500, text: FAULT }
    }
  }

  const server = createServer((req, res) => {
    let body = ""
    req.on("data", (chunk: Buffer) => (body += chunk.toString()))
    req.on("end", () => {
      const operation = /<soap:Body>\s*<(?:\w+:)?(\w+)/.exec(body)?.[1] ?? ""
      requests.push({ operation, body })
      const { status, text } = reply(operation, body)
      res.writeHead(status, { "content-type": "text/xml; charset=utf-8" }).end(text)
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    accounts,
    shipments,
    requests,
    hold: (cargoKey) => {
      held.add(cargoKey)
    },
    queue: (operation, errCode) => {
      queued.set(operation, [...(queued.get(operation) ?? []), errCode])
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
