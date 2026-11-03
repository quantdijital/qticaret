import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { serveTracking } from "../carrier/page"
import { stateFileFor, stateStore } from "../carrier/tracking"
import type { AdvanceMode } from "../carrier/tracking"
import type { LabelParty } from "../label-pdf"
import { TRACKING_STEPS, arasLabel, moveOrder, orderOf, trackedOrder } from "./orders"
import type { FakeArasOrder } from "./orders"

/**
 * A stand-in for Aras Kargo's customer service (adr/0035): the SOAP
 * operations the platform calls, answered in the shapes the test service's
 * description (WSDL) gives, a label drawn as Aras prints one, and Aras's
 * tracking page at `/takip/<tracking number>` (`carrier/page`). A parcel
 * moves on a step on each tracking read (`advance: "on-read"`, the tests'
 * default) or only from the page's buttons (`"manual"`). A wrong user name
 * or password is a SOAP fault, as a .NET service answers it.
 */

export { TRACKING_STEPS } from "./orders"
export type { FakeArasOrder } from "./orders"

export interface FakeArasAccount {
  username: string
  password: string
}

export interface FakeArasOptions {
  port?: number
  advance?: AdvanceMode
  /** The contract's sender, as Aras prints it on the label; none leaves the block off. */
  sender?: LabelParty
  /** Keeps the orders in the OS temp folder between runs (a developer's fake). */
  persist?: boolean
}

export interface FakeAras {
  url: string
  account: FakeArasAccount
  orders: Map<string, FakeArasOrder>
  requests: { operation: string; body: string }[]
  /** Pins a parcel where it stands: reads no longer move it on. */
  hold: (integrationCode: string) => void
  /** The next answer to an operation instead of the usual one (a refusal). */
  queue: (operation: string, resultCode: string) => void
  close: () => Promise<void>
}

/** A random account each run: no fixed secret a scanner could take for a real one (docs/04). */
export const fakeArasAccount = (): FakeArasAccount => ({
  username: `aras-${randomBytes(4).toString("hex")}`,
  password: randomBytes(12).toString("hex"),
})

const field = (body: string, name: string): string =>
  new RegExp(`<${name}>([^<]*)</${name}>`, "i").exec(body)?.[1] ?? ""

const envelope = (inner: string) =>
  `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`

const FAULT = envelope(
  "<soap:Fault><faultcode>soap:Server</faultcode><faultstring>Kullanıcı adı veya şifre hatalı</faultstring></soap:Fault>"
)

export async function startFakeAras(
  account: FakeArasAccount = fakeArasAccount(),
  options: FakeArasOptions = {}
): Promise<FakeAras> {
  const orders = new Map<string, FakeArasOrder>()
  const requests: FakeAras["requests"] = []
  const held = new Set<string>()
  const queued = new Map<string, string[]>()
  const sockets = new Set<Socket>()
  const sender = options.sender ?? null
  let store = stateStore<{ orders: [string, FakeArasOrder][] }>(null)
  const save = () => {
    store.save({ orders: [...orders.entries()] })
  }
  const numbered = (number: string) =>
    [...orders.values()].some((order) => order.trackingNumber === number)

  const answer = (operation: string, body: string): { status: number; text: string } => {
    const user = field(body, "userName") || field(body, "Username") || field(body, "username")
    const password = field(body, "password")
    if (user !== account.username || password !== account.password) {
      return { status: 500, text: FAULT }
    }
    const forced = queued.get(operation)?.shift()
    const code = field(body, "integrationCode") || field(body, "IntegrationCode")
    const order = orders.get(code)
    switch (operation) {
      case "SetOrder": {
        const result = forced ?? (orders.has(code) || !field(body, "ReceiverName") ? "936" : "0")
        if (result === "0") {
          orders.set(code, orderOf(body, code, numbered))
        }
        return {
          status: 200,
          text: envelope(
            `<SetOrderResponse xmlns="http://tempuri.org/"><SetOrderResult><OrderResultInfo><ResultCode>${result}</ResultCode><ResultMessage>${result === "0" ? "Başarılı" : "Hata"}</ResultMessage><InvoiceKey>${code}</InvoiceKey></OrderResultInfo></SetOrderResult></SetOrderResponse>`
          ),
        }
      }
      case "GetArasBarcode": {
        const result = forced ?? (order && !order.canceled ? "0" : "1")
        const pdf =
          result === "0" && order
            ? `<ZebraPdf><string>${arasLabel(order, sender).toString("base64")}</string></ZebraPdf>`
            : ""
        return {
          status: 200,
          text: envelope(
            `<GetArasBarcodeResponse xmlns="http://tempuri.org/"><GetArasBarcodeResult>${pdf}<Message/><ResultCode>${result}</ResultCode></GetArasBarcodeResult></GetArasBarcodeResponse>`
          ),
        }
      }
      case "CancelDispatch": {
        // Withdrawn while Aras has not picked it up yet
        const result = forced ?? (order && order.step < 0 ? "0" : "1")
        if (result === "0" && order) {
          order.canceled = true
        }
        return {
          status: 200,
          text: envelope(
            `<CancelDispatchResponse xmlns="http://tempuri.org/"><CancelDispatchResult><ResultCode>${result}</ResultCode><ResultMessage/></CancelDispatchResult></CancelDispatchResponse>`
          ),
        }
      }
      case "GetCargoInfo": {
        let rows = ""
        if (order && !order.canceled) {
          if ((options.advance ?? "on-read") === "on-read" && !held.has(code)) {
            moveOrder(order, order.step + 1)
          }
          const status = TRACKING_STEPS[order.step]
          rows = status
            ? `<IrsDataDataTable diffgr:id="1"><KARGO_TAKIP_NO>${order.trackingNumber}</KARGO_TAKIP_NO><DURUMU>${status}</DURUMU></IrsDataDataTable>`
            : ""
        }
        return {
          status: 200,
          text: envelope(
            `<GetCargoInfoResponse xmlns="http://tempuri.org/"><GetCargoInfoResult><xs:schema id="IrsaliyeData" xmlns:xs="http://www.w3.org/2001/XMLSchema"/><diffgr:diffgram xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1"><DocumentElement>${rows}</DocumentElement></diffgr:diffgram></GetCargoInfoResult></GetCargoInfoResponse>`
          ),
        }
      }
      case "GetOrderWithIntegrationCode":
        return {
          status: 200,
          text: envelope(
            `<GetOrderWithIntegrationCodeResponse xmlns="http://tempuri.org/"><GetOrderWithIntegrationCodeResult/></GetOrderWithIntegrationCodeResponse>`
          ),
        }
      default:
        return { status: 500, text: FAULT }
    }
  }

  const tracking = {
    carrier: "Aras Kargo",
    color: "#003a70",
    words: {
      picked_up: "Kargo teslim alındı",
      in_transit: "Transfer merkezinden çıkış yaptı",
      out_for_delivery: "Dağıtıma çıkarıldı",
    },
    find: (number: string) => {
      const order = [...orders.values()].find((each) => each.trackingNumber === number)
      return order ? trackedOrder(order, sender, save) : null
    },
  }

  const server = createServer((req, res) => {
    let body = ""
    req.on("data", (chunk: Buffer) => (body += chunk.toString()))
    req.on("end", () => {
      if (serveTracking(req, res, body, tracking)) {
        return
      }
      const operation = /<soap:Body>\s*<(\w+)/.exec(body)?.[1] ?? ""
      requests.push({ operation, body })
      const reply = answer(operation, body)
      save()
      res.writeHead(reply.status, { "content-type": "text/xml; charset=utf-8" }).end(reply.text)
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo
  if (options.persist) {
    store = stateStore(stateFileFor("aras", address.port))
    for (const [code, order] of store.load()?.orders ?? []) {
      orders.set(code, order)
    }
  }

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    account,
    orders,
    requests,
    hold: (code) => {
      held.add(code)
    },
    queue: (operation, resultCode) => {
      queued.set(operation, [...(queued.get(operation) ?? []), resultCode])
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
