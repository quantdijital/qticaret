import { randomBytes, randomInt } from "node:crypto"
import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { serveTracking } from "../carrier/page"
import type { TrackingPlace } from "../carrier/page"
import { stateFileFor, stateStore } from "../carrier/tracking"
import type { AdvanceMode } from "../carrier/tracking"
import {
  SOAP11,
  SOAP12,
  TRACK_NS,
  UPLOAD_NS,
  answer,
  checkDigit,
  coded,
  envelope,
  escape,
  fault,
} from "./soap"
import { field, moveShipment, pttTracking, shipmentOf, trackingRows } from "./shipments"
import type { FakePttShipment } from "./shipments"

/**
 * A stand-in for PTT Kargo's two web services (docs/entegrasyonlar/ptt.md),
 * live and test paths alike: the upload (`PttVeriYukleme`, SOAP 1.1:
 * `kabulEkle2`, `barkodVeriSil`) and tracking (`GonderiTakipV2`, SOAP 1.2
 * only: `gonderiSorgu2`). It holds the requests to what our sources say
 * PTT checks: the account, the fixed user `PttWs`, fields qualified by
 * the types' namespace, a file name used once, a barcode's check digit
 * and its use once, the receiver's name of at least 5, the `OS` service
 * for an amount collected at the door. Answers `hataKodu` 1 on success.
 * Its tracking page at `/takip/<barcode>` (`carrier/page`).
 */

export { TRACKING_STEPS } from "./shipments"
export type { FakePttShipment } from "./shipments"

export interface FakePttAccount {
  customerId: string
  password: string
}

export interface FakePttOptions {
  port?: number
  advance?: AdvanceMode
  origin?: TrackingPlace
  persist?: boolean
}

export interface FakePtt {
  url: string
  account: FakePttAccount
  shipments: Map<string, FakePttShipment>
  requests: { operation: string; body: string; test: boolean; contentType: string }[]
  hold: (barcode: string) => void
  /**
   * The next answer to an operation instead of the usual one: `lost` (the
   * parcel loaded, no answer), `fault` (a SOAP fault, HTTP 500, nothing
   * done) or `code:<n>:<text>` (this code and sentence, nothing done).
   */
  queue: (operation: string, answer: string) => void
  close: () => Promise<void>
}

/** A random account each run: no fixed secret a scanner could take for a real one (docs/04). */
export const fakePttAccount = (): FakePttAccount => ({
  customerId: String(randomInt(100_000_000, 999_999_999)),
  password: randomBytes(10).toString("hex"),
})

export async function startFakePtt(
  account: FakePttAccount = fakePttAccount(),
  options: FakePttOptions = {}
): Promise<FakePtt> {
  const shipments = new Map<string, FakePttShipment>()
  const files = new Set<string>()
  const requests: FakePtt["requests"] = []
  const held = new Set<string>()
  const queued = new Map<string, string[]>()
  const sockets = new Set<Socket>()
  let store = stateStore<{ shipments: [string, FakePttShipment][]; files: string[] }>(null)
  const save = () => {
    store.save({ shipments: [...shipments.entries()], files: [...files] })
  }

  const upload = (body: string, test: boolean, forced: string | undefined) => {
    const op = "kabulEkle2"
    const said = (code: number, text: string, line = "") => ({
      status: 200,
      text: answer(
        SOAP11,
        UPLOAD_NS,
        op,
        `<ax21:aciklama>${escape(text)}</ax21:aciklama>${line}<ax21:hataKodu>${String(code)}</ax21:hataKodu>`
      ),
    })
    if (
      field(body, "musteriId") !== account.customerId ||
      field(body, "sifre") !== account.password
    ) {
      return said(-1, "Müşteri no veya şifre hatalı.")
    }
    if (field(body, "kullanici") !== "PttWs") {
      return said(-2, "Kullanıcı bilgisi hatalı.")
    }
    // Axis2 reads the fields only in the types' namespace
    if (!body.includes(`"${UPLOAD_NS}/xsd"`) || !/<\w+:dongu>/.test(body)) {
      return { status: 500, text: fault(SOAP11) }
    }
    const barcode = field(body, "barkodNo")
    if (forced === "lost") {
      shipments.set(barcode, shipmentOf(body, test))
      files.add(field(body, "dosyaAdi"))
      return { status: 500, text: envelope(SOAP11, "") }
    }
    if (forced?.startsWith("code:")) {
      const [, code = "0", ...text] = forced.split(":")
      return said(Number(code), text.join(":"))
    }
    const fileName = field(body, "dosyaAdi")
    if (!fileName || fileName.length > 50 || files.has(fileName)) {
      return said(-3, "Dosya adı daha önce kullanılmış.")
    }
    const line = (code: number, text: string) =>
      `<ax21:dongu><ax21:barkod>${escape(barcode)}</ax21:barkod><ax21:donguAciklama>${escape(text)}</ax21:donguAciklama><ax21:donguHataKodu>${String(code)}</ax21:donguHataKodu><ax21:donguSonuc>${String(code === 1)}</ax21:donguSonuc></ax21:dongu>`
    let refusal: string | null = null
    if (!/^\d{13}$/.test(barcode) || checkDigit(barcode.slice(0, 12)) !== barcode.slice(12)) {
      refusal = "Barkod kontrol hanesi hatalı."
    } else if (shipments.has(barcode)) {
      refusal = "Barkod daha önce kullanılmış."
    } else if (Array.from(field(body, "aliciAdi")).length < 5) {
      refusal = "Alıcı adı en az 5 karakter olmalıdır."
    } else if (!/^\d{10}$/.test(field(body, "aliciSms"))) {
      refusal = "Alıcı SMS numarası hatalı."
    } else if (
      Number(field(body, "odeme_sart_ucreti") || 0) > 0 &&
      !field(body, "ekhizmet").includes("OS")
    ) {
      refusal = "Ödeme şartlı ücret için OS ek hizmeti gereklidir."
    }
    files.add(fileName)
    if (refusal) {
      return said(1, "İşlem tamamlandı.", line(-10, refusal))
    }
    shipments.set(barcode, shipmentOf(body, test))
    return said(1, "İşlem başarılı.", line(1, "Başarılı"))
  }

  const remove = (body: string, forced: string | undefined) => {
    const op = "barkodVeriSil"
    const said = (code: number, text: string) => ({
      status: 200,
      text: answer(SOAP11, UPLOAD_NS, op, coded(code, text)),
    })
    if (
      field(body, "musteriId") !== account.customerId ||
      field(body, "sifre") !== account.password
    ) {
      return said(-1, "Müşteri no veya şifre hatalı.")
    }
    if (forced?.startsWith("code:")) {
      const [, code = "0", ...text] = forced.split(":")
      return said(Number(code), text.join(":"))
    }
    const shipment = shipments.get(field(body, "barcode"))
    if (!shipment || shipment.canceled || shipment.fileName !== field(body, "dosyaAdi")) {
      return said(0, "Kayıt bulunamadı.")
    }
    if (shipment.step >= 0) {
      return said(0, "Kabulü yapılmış gönderi silinemez.")
    }
    shipment.canceled = true
    return said(1, "Silme işlemi başarılı.")
  }

  const track = (body: string) => {
    const op = "gonderiSorgu2"
    const result = (code: number, text: string, rows = "") => ({
      status: 200,
      text: answer(
        SOAP12,
        TRACK_NS,
        op,
        // The receiver's and sender's names come with every answer: the client must not keep them
        `<ax21:ALICI>AY** YI****</ax21:ALICI><ax21:BARNO>${escape(field(body, "barkod"))}</ax21:BARNO><ax21:GONDEREN>ANA DEPO</ax21:GONDEREN>${rows}<ax21:sonucAciklama>${escape(text)}</ax21:sonucAciklama><ax21:sonucKodu>${String(code)}</ax21:sonucKodu>`
      ),
    })
    if (
      field(body, "kullanici") !== account.customerId ||
      field(body, "sifre") !== account.password
    ) {
      return result(0, "Kullanıcı adı veya şifre hatalı.")
    }
    const barcode = field(body, "barkod")
    const shipment = shipments.get(barcode)
    if (!shipment || shipment.canceled) {
      return result(0, "Kayıt bulunamadı.")
    }
    if ((options.advance ?? "on-read") === "on-read" && !held.has(barcode)) {
      moveShipment(shipment, shipment.step + 1)
    }
    return shipment.step < 0
      ? result(0, "Kayıt bulunamadı.")
      : result(1, "Başarılı", trackingRows(shipment, "ax21"))
  }

  const reply = (
    path: string,
    operation: string,
    body: string,
    contentType: string
  ): { status: number; text: string; type: string } => {
    const uploading = /^\/PttVeriYukleme(Test)?\/services\/Sorgu\/?$/.test(path)
    const tracking = /^\/GonderiTakipV2(Test)?\/services\/Sorgu\/?$/.test(path)
    const test = path.includes("Test/")
    const forced = queued.get(operation)?.shift()
    if (tracking) {
      const type = "application/soap+xml; charset=utf-8"
      // Tracking's one port is SOAP 1.2
      if (!contentType.startsWith("application/soap+xml") || !body.includes(SOAP12)) {
        return { status: 415, text: "", type: "text/plain" }
      }
      if (forced === "fault") {
        return { status: 500, text: fault(SOAP12), type }
      }
      return operation === "gonderiSorgu2" || operation === "gonderiSorgu"
        ? { ...track(body), type }
        : { status: 500, text: fault(SOAP12), type }
    }
    const type = "text/xml; charset=utf-8"
    if (!uploading) {
      return { status: 404, text: "", type: "text/plain" }
    }
    if (forced === "fault") {
      return { status: 500, text: fault(SOAP11), type }
    }
    switch (operation) {
      case "kabulEkle2":
        return { ...upload(body, test, forced), type }
      case "barkodVeriSil":
        return { ...remove(body, forced), type }
      default:
        return { status: 500, text: fault(SOAP11), type }
    }
  }

  const tracking = pttTracking(shipments, options.origin ?? null, save)
  const server = createServer((req, res) => {
    let body = ""
    req.on("data", (chunk: Buffer) => (body += chunk.toString()))
    req.on("end", () => {
      if (serveTracking(req, res, body, tracking)) {
        return
      }
      const path = new URL(req.url ?? "/", "http://fake").pathname
      const operation = /<(?:\w+:)?Body>\s*<(?:\w+:)?(\w+)/.exec(body)?.[1] ?? ""
      const contentType = req.headers["content-type"] ?? ""
      requests.push({ operation, body, test: path.includes("Test/"), contentType })
      const { status, text, type } = reply(path, operation, body, contentType)
      save()
      res.writeHead(status, { "content-type": type }).end(text)
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo
  if (options.persist) {
    store = stateStore(stateFileFor("ptt", address.port))
    const saved = store.load()
    for (const [barcode, shipment] of saved?.shipments ?? []) {
      shipments.set(barcode, shipment)
    }
    for (const file of saved?.files ?? []) {
      files.add(file)
    }
  }

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    account,
    shipments,
    requests,
    hold: (barcode) => {
      held.add(barcode)
    },
    queue: (operation, value) => {
      queued.set(operation, [...(queued.get(operation) ?? []), value])
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
