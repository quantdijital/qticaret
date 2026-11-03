import {
  yurticiCredentialsOf,
  yurticiDesi,
  yurticiLabelPdf,
  yurticiOperationStatus,
  yurticiReceiverGap,
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
  operationStatus: null,
  operationMessage: null,
  docId: null,
  trackingUrl: null,
  rejectStatus: null,
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
      desi: "1.500",
      kg: "0.450",
      cargoCount: 1,
      ttInvoiceAmount: "249.90",
      ttDocumentId: "1042",
      ttCollectionType: "0",
      ttDocumentSaveType: "0",
    })
    expect(yurticiShipmentFields(shipment("QT01ABCDEF"))).toMatchObject({
      ttInvoiceAmount: null,
      ttCollectionType: null,
      ttDocumentSaveType: null,
    })
  })

  it("sends the phone as ten digits and the unused numbers empty, as the document does", () => {
    const fields = yurticiShipmentFields(shipment("QT01ABCDEF"))

    // Document: "Alan kodu ile birlikte 10 adet rakam"; its requests send 2123652426
    expect(fields["receiverPhone1"]).toBe("5321234567")
    // Its requests carry <taxOfficeId/>, <ttDocumentId/>, <dcSelectedCredit/>, <dcCreditRule/>
    expect(fields).toMatchObject({
      taxOfficeId: "",
      ttDocumentId: "",
      dcSelectedCredit: "",
      dcCreditRule: "",
    })
    // The il and the ilçe go in their own fields, not in the address
    expect(fields["receiverAddress"]).toBe("Moda Mah., Atatürk Cad. No: 5")
  })

  it("finds the receiver Yurtiçi refuses before asking it: a short name, a short address", () => {
    const receiver = receiverOf(address)

    expect(yurticiReceiverGap(receiver)).toBeNull()
    expect(yurticiReceiverGap({ ...receiver, name: "Al Ay" })).toBeNull()
    expect(yurticiReceiverGap({ ...receiver, name: "Ab C" })).toBe("first_name")
    // Five characters, two of them letters
    expect(yurticiReceiverGap({ ...receiver, name: "A1 B2" })).toBe("first_name")
    expect(yurticiReceiverGap({ ...receiver, address: "No: 5, 34" })).toBe("address_1")
    // Eight letters and digits, then eleven
    expect(yurticiReceiverGap({ ...receiver, address: "Ev 12, Sk. 34" })).toBe("address_1")
    expect(yurticiReceiverGap({ ...receiver, address: "Ev 12, Sokak 34" })).toBeNull()
  })

  it("leaves desi and kg out for a parcel without measures: optional there, the branch measures (adr/0054)", async () => {
    const unmeasured = { ...shipment("QT01ABCDEF"), desi: null, kg: null }
    const fields = yurticiShipmentFields(unmeasured)
    const pdf = await yurticiLabelPdf({ ...unmeasured, test: true })

    expect(fields["desi"]).toBeNull()
    expect(fields["kg"]).toBeNull()
    expect(fields).toMatchObject({ cargoKey: "QT01ABCDEF", cargoCount: 1 })
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-")
  })

  it("sends the volume's desi apart from the weight: volume / 3000, one decimal up", () => {
    expect(yurticiDesi({ length_cm: 30, width_cm: 20, height_cm: 10 })).toBe(2)
    expect(yurticiDesi({ length_cm: 10.1, width_cm: 10.1, height_cm: 10.1 })).toBe(0.4)
    expect(yurticiDesi({ length_cm: 15, width_cm: 15, height_cm: 15 })).toBe(1.2)
  })

  it("reads the stage from the operation's letters, its code only standing in", () => {
    expect(yurticiOperationStatus("cnl", 2)).toBe("CNL")
    expect(yurticiOperationStatus(null, 3)).toBe("CNL")
    expect(yurticiOperationStatus("XYZ", null)).toBeNull()
    expect(yurticiOperationStatus("__proto__", 9)).toBeNull()
    expect(yurticiStatusOf(delivery({ found: false })).status).toBe("created")
    expect(yurticiStatusOf(delivery({ operationCode: 0 })).status).toBe("created")
    expect(yurticiStatusOf(delivery({ operationCode: 2 })).status).toBe("picked_up")
    expect(yurticiStatusOf(delivery({ operationCode: 1 })).status).toBe("in_transit")
    // The document's sample answers number CNL as 2: the letters win
    expect(yurticiStatusOf(delivery({ operationCode: 2, operationStatus: "CNL" })).status).toBe(
      "canceled"
    )
    expect(yurticiStatusOf(delivery({ operationStatus: "BI", operationCode: 6 })).status).toBe(
      "canceled"
    )
    expect(yurticiStatusOf(delivery({ words: ["Dağıtıma çıkarıldı"] })).status).toBe(
      "out_for_delivery"
    )
    expect(yurticiStatusOf(delivery({ words: ["Teslim edilemedi"] })).status).toBe("failed")
    expect(yurticiStatusOf(delivery({ operationCode: 5 })).status).toBe("delivered")
    expect(yurticiStatusOf(delivery({ operationCode: 4 })).status).toBe("canceled")
  })

  it("reads a return from its own code: 0–3, 9 and 10 return, 4, 7, 8 and 11 call it off", () => {
    const of = (rejectStatus: string, operationStatus = "IND") =>
      yurticiStatusOf(delivery({ operationStatus, rejectStatus })).status

    expect(["0", "1", "2", "3", "9", "10"].map((code) => of(code))).toEqual(
      Array(6).fill("returned")
    )
    expect(of("10", "DLV")).toBe("returned")
    // "İade Bekletiliyor", "İade Onaylanmadı": the parcel goes on, whatever the words say
    expect(["4", "7", "8", "11"].map((code) => of(code))).toEqual(Array(4).fill("in_transit"))
    // Withdrawn after its document was issued: Yurtiçi's own words for a return request
    expect(
      yurticiStatusOf(
        delivery({ operationStatus: "IND", operationMessage: "İade isteği Alınmıştır" })
      ).status
    ).toBe("returned")
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
    // No document yet: Yurtiçi answers docId 0
    expect(yurticiStatusOf(delivery({ docId: "0" })).tracking_number).toBeNull()
  })

  it("links a parcel to the fake's own page when a fake Yurtiçi is set, whatever it answers", () => {
    const fake = "http://127.0.0.1:9105"
    const page = "https://selfservis.yurticikargo.com/reports/SSWDocumentDetail.aspx?DocId=1"

    expect(yurticiStatusOf(delivery({ docId: "100000000001" }), fake).tracking_url).toBe(
      "http://127.0.0.1:9105/takip/100000000001"
    )
    expect(
      yurticiStatusOf(delivery({ docId: "100000000001", trackingUrl: page }), fake).tracking_url
    ).toBe("http://127.0.0.1:9105/takip/100000000001")
    expect(yurticiStatusOf(delivery({ docId: "0" }), fake).tracking_url).toBeNull()
    // No fake set: Yurtiçi's own pages, as a live shop's
    expect(yurticiStatusOf(delivery({ docId: "100000000001" }), null).tracking_url).toBe(
      "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=100000000001"
    )
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
