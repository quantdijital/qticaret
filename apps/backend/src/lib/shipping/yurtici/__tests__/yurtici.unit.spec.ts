import { startFakeYurtici } from "@qticaret/testing"
import type { FakeYurtici } from "@qticaret/testing"
import {
  createYurticiApi,
  yurticiCredentialsOf,
  yurticiLabelPdf,
  yurticiShipmentFields,
  yurticiStatusOf,
} from ".."
import type { YurticiDelivery, YurticiShipmentInput } from ".."
import { PDFDocument } from "pdf-lib"
import { MM } from "../../../pdf"
import { receiverOf } from "../../receiver"

const address = {
  first_name: "Ayşe",
  last_name: "Yılmaz",
  phone: "+905321234567",
  address_1: "Atatürk Cad. No: 5",
  address_2: "Moda Mah.",
  city: "Kadıköy",
  province: "İstanbul",
  postal_code: "34710",
  country_code: "tr",
}

const shipment = (
  cargoKey: string,
  cashOnDelivery: number | null = null
): YurticiShipmentInput => ({
  cargoKey,
  orderNumber: "1042",
  receiver: receiverOf(address),
  desi: 1.5,
  kg: 0.45,
  cashOnDelivery,
})

const delivery = (overrides: Partial<YurticiDelivery>): YurticiDelivery => ({
  found: true,
  operationCode: 1,
  operationMessage: null,
  docId: null,
  trackingUrl: null,
  words: [],
  ...overrides,
})

describe("Yurtiçi (adr/0035)", () => {
  it("reads the panel's account: the main login needed, the door account only whole", () => {
    const main = { username: "u", password: "p" }
    expect(yurticiCredentialsOf({ settings: { test_mode: true }, secrets: main })).toEqual({
      main,
      cod: null,
      testMode: true,
    })
    expect(
      yurticiCredentialsOf({
        settings: {},
        secrets: { ...main, cod_username: "c", cod_password: "q" },
      })?.cod
    ).toEqual({ username: "c", password: "q" })
    expect(
      yurticiCredentialsOf({ settings: {}, secrets: { ...main, cod_username: "c" } })?.cod
    ).toBeNull()
    expect(yurticiCredentialsOf({ settings: {}, secrets: { username: "u" } })).toBeNull()
  })

  it("asks the courier to collect at the door only when the order is paid there", () => {
    expect(yurticiShipmentFields(shipment("QT01ABCDEF", 24_990))).toMatchObject({
      cargoKey: "QT01ABCDEF",
      invoiceKey: "QT01ABCDEF",
      receiverAddress: "Moda Mah., Atatürk Cad. No: 5",
      cityName: "İstanbul",
      townName: "Kadıköy",
      receiverPhone1: "05321234567",
      desi: "1.500",
      cargoCount: 1,
      ttInvoiceAmount: "249.90",
      ttDocumentId: "1042",
      ttCollectionType: "0",
      ttDocumentSaveType: "0",
    })
    expect(yurticiShipmentFields(shipment("QT01ABCDEF"))).toMatchObject({
      ttInvoiceAmount: null,
      ttDocumentId: 0,
      ttCollectionType: null,
    })
  })

  it("reads the stage from the operation code and the last mile from Yurtiçi's words", () => {
    expect(yurticiStatusOf(delivery({ found: false })).status).toBe("created")
    expect(yurticiStatusOf(delivery({ operationCode: 0 })).status).toBe("created")
    expect(yurticiStatusOf(delivery({ operationCode: 2 })).status).toBe("picked_up")
    expect(yurticiStatusOf(delivery({ operationCode: 1 })).status).toBe("in_transit")
    expect(yurticiStatusOf(delivery({ words: ["Dağıtıma çıkarıldı"] })).status).toBe(
      "out_for_delivery"
    )
    expect(yurticiStatusOf(delivery({ words: ["Teslim edilemedi"] })).status).toBe("failed")
    expect(yurticiStatusOf(delivery({ operationCode: 5 })).status).toBe("delivered")
    expect(
      yurticiStatusOf(delivery({ operationCode: 5, words: ["Göndericiye iade"] })).status
    ).toBe("returned")
    expect(yurticiStatusOf(delivery({ operationCode: 4 })).status).toBe("canceled")
  })

  it("takes Yurtiçi's tracking link only on its own https hosts, else its page for the number", () => {
    const page = "https://selfservis.yurticikargo.com/reports/SSWDocumentDetail.aspx?DocId=1"
    const linkOf = (trackingUrl: string) =>
      yurticiStatusOf(delivery({ docId: "100000000001", trackingUrl })).tracking_url

    expect(yurticiStatusOf(delivery({ docId: "100000000001", trackingUrl: page }))).toMatchObject({
      tracking_number: "100000000001",
      tracking_url: page,
    })
    for (const foreign of [
      "javascript:alert(1)",
      "http://selfservis.yurticikargo.com/x",
      "https://yurticikargo.com.evil.example/x",
      "https://evil.example/?yurticikargo.com",
    ]) {
      expect(linkOf(foreign)).toContain("code=100000000001")
    }
  })

  it("draws a 100×150 mm PDF label, whatever the shopper typed", async () => {
    const pdf = await yurticiLabelPdf({
      ...shipment("QT01ABCDEF", 24_990),
      receiver: {
        ...receiverOf(address),
        name: `Ayşe <script> \u0007 Yılmaz 😀 ${"uzun ".repeat(40)}`,
      },
      test: true,
    })
    const doc = await PDFDocument.load(pdf, { updateMetadata: false })
    const [page] = doc.getPages()

    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-")
    expect(doc.getPageCount()).toBe(1)
    expect(page?.getWidth()).toBeCloseTo(283.46, 1)
    expect(page?.getHeight()).toBeCloseTo(425.2, 1)
    expect(doc.getTitle()).toBe("Yurtiçi Kargo QT01ABCDEF")
    expect(doc.getProducer()).toBe("Quant Ticaret")
  })

  it("draws the label on the shop's own roll size", async () => {
    const sizes = await Promise.all(
      [
        { width_mm: 100, height_mm: 100 },
        { width_mm: 80, height_mm: 80 },
        { width_mm: 70, height_mm: 70 },
      ].map(async (size) => {
        const pdf = await yurticiLabelPdf(
          { ...shipment("QT01ABCDEFGHIJKLMN", 24_990), test: false },
          size
        )
        const [page] = (await PDFDocument.load(pdf)).getPages()
        return [Math.round((page?.getWidth() ?? 0) / MM), Math.round((page?.getHeight() ?? 0) / MM)]
      })
    )

    expect(sizes).toEqual([
      [100, 100],
      [80, 80],
      [70, 70],
    ])
  })
})

describe("Yurtiçi client against the fake service (adr/0035)", () => {
  let fake: FakeYurtici
  const api = () => createYurticiApi({ baseUrl: fake.url })

  beforeAll(async () => {
    fake = await startFakeYurtici()
  })

  afterAll(async () => {
    await fake.close()
  })

  it("opens a parcel under our key in a JAX-WS body, and refuses the same key twice", async () => {
    await api().createShipment(fake.accounts.main, true, shipment("QTUNITKEY000001"))
    const twice = await api()
      .createShipment(fake.accounts.main, true, shipment("QTUNITKEY000001"))
      .catch((error: unknown) => error)
    const [sent] = fake.requests

    expect(sent?.body).toContain(
      '<op:createShipment xmlns:op="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">'
    )
    expect(sent?.body).toContain(`<wsUserName>${fake.accounts.main.username}</wsUserName>`)
    expect(fake.shipments.get("QTUNITKEY000001")).toMatchObject({
      account: "main",
      receiverName: "Ayşe Yılmaz",
    })
    expect(twice).toMatchObject({ providerCode: "error_60020" })
  })

  it("follows the parcel on the login that opened it only", async () => {
    await api().createShipment(fake.accounts.cod, true, shipment("QTUNITKEY000002", 10_000))

    const elsewhere = await api().query(fake.accounts.main, true, "QTUNITKEY000002")
    const first = await api().query(fake.accounts.cod, true, "QTUNITKEY000002")

    expect(elsewhere.found).toBe(false)
    expect(first).toMatchObject({ found: true, operationCode: 2 })
    expect(yurticiStatusOf(first)).toMatchObject({
      status: "picked_up",
      tracking_number: expect.stringMatching(/^\d{12}$/) as string,
    })
    expect(fake.shipments.get("QTUNITKEY000002")).toMatchObject({
      account: "cod",
      codAmount: "100.00",
      codDocumentId: "1042",
    })
  })

  it("withdraws a parcel the branch has not taken, again without harm, and not after", async () => {
    await api().createShipment(fake.accounts.main, true, shipment("QTUNITKEY000003"))
    await api().cancel(fake.accounts.main, true, "QTUNITKEY000003")
    await api().cancel(fake.accounts.main, true, "QTUNITKEY000003")
    await api().createShipment(fake.accounts.main, true, shipment("QTUNITKEY000004"))
    await api().query(fake.accounts.main, true, "QTUNITKEY000004")

    const late = await api()
      .cancel(fake.accounts.main, true, "QTUNITKEY000004")
      .catch((error: unknown) => error)

    expect(fake.shipments.get("QTUNITKEY000003")?.canceled).toBe(true)
    expect(late).toMatchObject({ providerCode: "error_82512" })
  })

  it("tells a login Yurtiçi takes from one it refuses", async () => {
    expect(await api().checkLogin(fake.accounts.main, true)).toBe("valid")
    expect(await api().checkLogin({ username: "yanlis", password: "yanlis-sifre" }, true)).toBe(
      "secret_invalid"
    )
  })
})
