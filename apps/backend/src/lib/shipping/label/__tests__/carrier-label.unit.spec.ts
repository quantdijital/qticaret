import { PDFDocument } from "pdf-lib"
import { carrierLabelPdf } from ".."
import type { CarrierLabelInput } from ".."
import { MM } from "../../../pdf"
import { receiverOf } from "../../receiver"

const label = (overrides: Partial<CarrierLabelInput> = {}): CarrierLabelInput => ({
  carrier: "DHL eCommerce",
  code: "C@6B@H21FMLRPNAAA6J",
  shipmentNumber: "100000000001",
  sender: { name: "Örnek Bıçak Ltd. Şti.", address: "Moda Cad. No: 1 Kadıköy", phone: null },
  orderNumber: "1042",
  receiver: receiverOf({
    first_name: "Ayşe",
    last_name: "Yılmaz",
    phone: "05321234567",
    address_1: "Atatürk Cad. No: 5",
    city: "Kadıköy",
    province: "İstanbul",
  }),
  desi: 2,
  kg: 1,
  cashOnDelivery: 24_990,
  test: false,
  ...overrides,
})

/** The shared label (lib/shipping/label): Yurtiçi's and DHL eCommerce's, drawn on our server. */
describe("carrierLabelPdf", () => {
  it("draws one page of the roll's size, titled by the carrier and its code", async () => {
    const pdf = await carrierLabelPdf(label())
    const doc = await PDFDocument.load(pdf, { updateMetadata: false })
    const [page] = doc.getPages()

    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-")
    expect(doc.getPageCount()).toBe(1)
    expect(Math.round((page?.getWidth() ?? 0) / MM)).toBe(100)
    expect(Math.round((page?.getHeight() ?? 0) / MM)).toBe(150)
    expect(doc.getTitle()).toBe("DHL eCommerce C@6B@H21FMLRPNAAA6J")
  })

  it("draws on a small roll, with or without the sender, a test mark and a long name", async () => {
    const sizes = await Promise.all(
      [
        label({ sender: null, shipmentNumber: null, cashOnDelivery: null, desi: null, kg: null }),
        label({
          test: true,
          receiver: { ...label().receiver, name: `Ayşe <b> \u0007 😀 ${"uzun ".repeat(40)}` },
          piece: { index: 1, count: 2 },
        }),
      ].map(async (input) => {
        const pdf = await carrierLabelPdf(input, { width_mm: 80, height_mm: 80 })
        const [page] = (await PDFDocument.load(pdf)).getPages()
        return Math.round((page?.getWidth() ?? 0) / MM)
      })
    )

    expect(sizes).toEqual([80, 80])
  })

  it("refuses a code a Code 128 B barcode cannot carry", async () => {
    await expect(carrierLabelPdf(label({ code: "İ" }))).rejects.toThrow(RangeError)
  })
})
