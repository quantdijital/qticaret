import { randomBytes } from "node:crypto"
import { tinyPdf } from "../pdf"
import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"

/**
 * A stand-in for Aras Kargo's customer service (adr/0035): the SOAP
 * operations the platform calls, answered in the shapes the test service's
 * description (WSDL) gives. Orders are kept by our integration code; a
 * parcel's tracking moves one step on each read, like Geliver's test
 * shipments, until delivered. A wrong user name or password is a SOAP
 * fault, as a .NET service answers it.
 */

export interface FakeArasAccount {
  username: string
  password: string
}

export interface FakeArasOrder {
  integrationCode: string
  receiverName: string
  city: string
  town: string
  isCod: boolean
  codAmount: string
  trackingNumber: string
  /** Steps of `TRACKING_STEPS` read so far; -1 before the first. */
  step: number
  canceled: boolean
}

/** What Aras shows for a parcel, read by read. */
export const TRACKING_STEPS = ["TESLİM ALINDI", "YOLDA", "DAĞITIMDA", "TESLİM EDİLDİ"] as const

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
  username: `sahte-${randomBytes(4).toString("hex")}`,
  password: randomBytes(12).toString("hex"),
})

const field = (body: string, name: string): string =>
  new RegExp(`<${name}>([^<]*)</${name}>`, "i").exec(body)?.[1] ?? ""

const envelope = (inner: string) =>
  `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`

const FAULT = envelope(
  "<soap:Fault><faultcode>soap:Server</faultcode><faultstring>Kullanıcı adı veya şifre hatalı</faultstring></soap:Fault>"
)

// A real one-page PDF, so a merged print counts it
const PDF = tinyPdf("sahte-aras-etiketi").toString("base64")

export async function startFakeAras(
  account: FakeArasAccount = fakeArasAccount(),
  options: { port?: number } = {}
): Promise<FakeAras> {
  const orders = new Map<string, FakeArasOrder>()
  const requests: FakeAras["requests"] = []
  const held = new Set<string>()
  const queued = new Map<string, string[]>()
  const sockets = new Set<Socket>()

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
          orders.set(code, {
            integrationCode: code,
            receiverName: field(body, "ReceiverName"),
            city: field(body, "ReceiverCityName"),
            town: field(body, "ReceiverTownName"),
            isCod: field(body, "IsCod") === "1",
            codAmount: field(body, "CodAmount"),
            trackingNumber: String(1_000_000_000 + orders.size),
            step: -1,
            canceled: false,
          })
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
        const pdf = result === "0" ? `<ZebraPdf><string>${PDF}</string></ZebraPdf>` : ""
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
          if (!held.has(code)) {
            order.step = Math.min(order.step + 1, TRACKING_STEPS.length - 1)
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

  const server = createServer((req, res) => {
    let body = ""
    req.on("data", (chunk: Buffer) => (body += chunk.toString()))
    req.on("end", () => {
      const operation = /<soap:Body>\s*<(\w+)/.exec(body)?.[1] ?? ""
      requests.push({ operation, body })
      const reply = answer(operation, body)
      res.writeHead(reply.status, { "content-type": "text/xml; charset=utf-8" }).end(reply.text)
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
