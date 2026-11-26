import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { serveTracking } from "../carrier/page"
import type { TrackingPlace } from "../carrier/page"
import { stateFileFor, stateStore } from "../carrier/tracking"
import type { AdvanceMode } from "../carrier/tracking"
import type { LabelParty } from "../label-pdf"
import {
  TRACKING_STEPS,
  field,
  moveShipment,
  shipmentOf,
  suratLabel,
  suratTracking,
  trackingJson,
} from "./shipments"
import type { FakeSuratShipment } from "./shipments"

/**
 * A stand-in for Sürat Kargo's web service (docs/entegrasyonlar/surat.md),
 * which has no test service of its own: the ASMX operations the platform
 * calls, answered as our sources describe them. Opening, deleting and
 * withdrawing answer free text ("Tamam" on success, Sürat's sentence
 * otherwise); tracking a JSON string, empty while Sürat does not know the
 * code. Two logins: the shipping one (`KullaniciAdi`, `Sifre`) opens and
 * withdraws; the cari kodu and web password track, label and delete (the
 * shipping one is taken there too: a shop Sürat gave one pair). Sürat's
 * own label only with `barcode` (Sürat seldom grants it). Its tracking
 * page at `/takip/<KargoTakipNo>` (`carrier/page`).
 */

export { TRACKING_STEPS } from "./shipments"
export type { FakeSuratShipment } from "./shipments"

export interface FakeSuratAccounts {
  shipping: { username: string; password: string }
  tracking: { cariCode: string; webPassword: string }
}

export interface FakeSuratOptions {
  port?: number
  advance?: AdvanceMode
  origin?: TrackingPlace
  /** The account may make Sürat's own label (`KargoBarkodu`). */
  barcode?: boolean
  sender?: LabelParty
  persist?: boolean
}

export interface FakeSurat {
  url: string
  accounts: FakeSuratAccounts
  shipments: Map<string, FakeSuratShipment>
  requests: { operation: string; body: string }[]
  hold: (code: string) => void
  /**
   * The next answer to an operation instead of the usual one: `lost` (the
   * parcel opened, no answer), `fault` (a SOAP fault, HTTP 500, nothing
   * done), `say:<text>` (this sentence, nothing done) or `open:<text>` (this
   * sentence, the parcel opened all the same).
   */
  queue: (operation: string, answer: string) => void
  close: () => Promise<void>
}

/** Random logins each run: no fixed secret a scanner could take for a real one (docs/04). */
export const fakeSuratAccounts = (): FakeSuratAccounts => ({
  shipping: {
    username: `surat-${randomBytes(4).toString("hex")}`,
    password: randomBytes(12).toString("hex"),
  },
  tracking: {
    cariCode: String(100000 + (randomBytes(2).readUInt16BE() % 900000)),
    webPassword: randomBytes(10).toString("hex"),
  },
})

const envelope = (inner: string) =>
  `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** An operation's answer: its result element holding `inner` (text already escaped, or elements). */
const result = (operation: string, inner: string) =>
  envelope(
    `<${operation}Response xmlns="http://tempuri.org/"><${operation}Result>${inner}</${operation}Result></${operation}Response>`
  )

const said = (operation: string, text: string) => ({
  status: 200,
  text: result(operation, escape(text)),
})

const FAULT = envelope(
  "<soap:Fault><faultcode>soap:Server</faultcode><faultstring>Sunucu hatası</faultstring></soap:Fault>"
)

export async function startFakeSurat(
  accounts: FakeSuratAccounts = fakeSuratAccounts(),
  options: FakeSuratOptions = {}
): Promise<FakeSurat> {
  const shipments = new Map<string, FakeSuratShipment>()
  const requests: FakeSurat["requests"] = []
  const held = new Set<string>()
  const queued = new Map<string, string[]>()
  const sockets = new Set<Socket>()
  let store = stateStore<{ shipments: [string, FakeSuratShipment][] }>(null)
  const save = () => {
    store.save({ shipments: [...shipments.entries()] })
  }
  const numbered = (number: string) =>
    [...shipments.values()].some((shipment) => shipment.trackingNumber === number)

  const shippingLogin = (body: string) =>
    field(body, "KullaniciAdi") === accounts.shipping.username &&
    field(body, "Sifre") === accounts.shipping.password
  const trackingLogin = (body: string) => {
    const user = field(body, "CariKodu") || field(body, "cariKodu")
    const password = field(body, "WebPassword") || field(body, "Sifre")
    return (
      (user === accounts.tracking.cariCode && password === accounts.tracking.webPassword) ||
      (user === accounts.shipping.username && password === accounts.shipping.password)
    )
  }

  const create = (body: string, forced: string | undefined) => {
    const op = "GonderiyiKargoyaGonderYeni"
    if (!shippingLogin(body)) {
      return said(op, "Kullanıcı adı veya şifre hatalı.")
    }
    const code = field(body, "OzelKargoTakipNo")
    if (forced === "lost" || forced?.startsWith("open:")) {
      shipments.set(code, shipmentOf(body, numbered))
      return forced === "lost"
        ? { status: 500, text: envelope("") }
        : said(op, forced.slice("open:".length))
    }
    if (forced?.startsWith("say:")) {
      return said(op, forced.slice("say:".length))
    }
    if (shipments.has(code)) {
      return said(op, "Bu özel kargo takip numarası daha önce kullanılmıştır.")
    }
    if (
      !field(body, "KisiKurum") ||
      !field(body, "AliciAdresi") ||
      !/^\d{10}$/.test(field(body, "TelefonCep"))
    ) {
      return said(op, "Alıcı bilgileri eksik ya da hatalı.")
    }
    shipments.set(code, shipmentOf(body, numbered))
    return said(op, "Tamam")
  }

  const label = (body: string) => {
    const op = "KargoBarkodu"
    const code = field(body, "ozelKargoTakipNo")
    const shipment = shipments.get(code)
    if (!trackingLogin(body)) {
      return said(op, "Cari kodu veya şifre hatalı.")
    }
    if (!options.barcode || !shipment || shipment.canceled) {
      return {
        status: 200,
        text: result(
          op,
          `<OzelKargoTakipNo>${escape(code)}</OzelKargoTakipNo><Aciklama>Barkod oluşturma yetkiniz bulunmamaktadır.</Aciklama>`
        ),
      }
    }
    const pdf = suratLabel(shipment, options.sender ?? null).toString("base64")
    return {
      status: 200,
      text: result(
        op,
        `<OzelKargoTakipNo>${escape(code)}</OzelKargoTakipNo><KargoTakipNo>${shipment.trackingNumber}</KargoTakipNo><Aciklama>Tamam</Aciklama><PdfBarkod>${pdf}</PdfBarkod>`
      ),
    }
  }

  const remove = (body: string, forced: string | undefined) => {
    const op = "GonderiSil"
    if (!trackingLogin(body)) {
      return said(op, "Cari kodu veya şifre hatalı.")
    }
    if (forced?.startsWith("say:")) {
      return said(op, forced.slice("say:".length))
    }
    const shipment = shipments.get(field(body, "ozelKargoTakipNo"))
    if (!shipment || shipment.canceled) {
      return said(op, "Kayıt bulunamadı.")
    }
    if (shipment.step >= 0) {
      return said(op, "Şubede işlem görmüş gönderi silinemez.")
    }
    shipment.canceled = true
    return said(op, "Tamam")
  }

  const withdraw = (body: string, forced: string | undefined) => {
    const op = "GonderiGeriCek"
    if (!shippingLogin(body)) {
      return said(op, "Kullanıcı adı veya şifre hatalı.")
    }
    if (forced?.startsWith("say:")) {
      return said(op, forced.slice("say:".length))
    }
    const shipment = shipments.get(field(body, "OzelKargoTakipNo"))
    if (!shipment || shipment.canceled || shipment.step >= TRACKING_STEPS.length - 1) {
      return said(op, "Gönderi geri çekilemez.")
    }
    shipment.withdrawn = true
    return said(op, "Tamam")
  }

  const track = (body: string) => {
    const op = "KargoTakipHareketDetayi"
    if (!trackingLogin(body)) {
      return said(
        op,
        JSON.stringify({
          IsError: true,
          errorMessage: "Cari kodu veya şifre hatalı.",
          Gonderiler: null,
        })
      )
    }
    const code = field(body, "WebSiparisKodu")
    const shipment = shipments.get(code)
    if (!shipment || shipment.canceled) {
      return said(op, "")
    }
    if ((options.advance ?? "on-read") === "on-read" && !held.has(code) && !shipment.withdrawn) {
      moveShipment(shipment, shipment.step + 1)
    }
    // Before the branch has it Sürat lists nothing (the plugin: "not handed over yet")
    return said(op, shipment.step < 0 ? "" : trackingJson(shipment))
  }

  const reply = (operation: string, body: string): { status: number; text: string } => {
    const forced = queued.get(operation)?.shift()
    if (forced === "fault") {
      return { status: 500, text: FAULT }
    }
    switch (operation) {
      case "GonderiyiKargoyaGonderYeni":
        return create(body, forced)
      case "KargoBarkodu":
        return label(body)
      case "GonderiSil":
        return remove(body, forced)
      case "GonderiGeriCek":
        return withdraw(body, forced)
      case "KargoTakipHareketDetayi":
        return track(body)
      default:
        return { status: 500, text: FAULT }
    }
  }

  const tracking = suratTracking(shipments, options.origin ?? null, save)
  const server = createServer((req, res) => {
    let body = ""
    req.on("data", (chunk: Buffer) => (body += chunk.toString()))
    req.on("end", () => {
      if (serveTracking(req, res, body, tracking)) {
        return
      }
      const operation = /<soap:Body>\s*<(?:\w+:)?(\w+)/.exec(body)?.[1] ?? ""
      requests.push({ operation, body })
      const { status, text } = reply(operation, body)
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
    store = stateStore(stateFileFor("surat", address.port))
    for (const [code, shipment] of store.load()?.shipments ?? []) {
      shipments.set(code, shipment)
    }
  }

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    accounts,
    shipments,
    requests,
    hold: (code) => {
      held.add(code)
    },
    queue: (operation, answer) => {
      queued.set(operation, [...(queued.get(operation) ?? []), answer])
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
