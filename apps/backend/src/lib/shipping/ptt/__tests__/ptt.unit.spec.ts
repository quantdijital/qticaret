import {
  barcodesLow,
  isPttBarcode,
  pttBarcodeOf,
  pttCheckDigit,
  pttCredentialsOf,
  pttShipmentFields,
  pttStatusOf,
  pttTrackingUrl,
  rangeSize,
  serialOf,
} from ".."
import type { PttEvent, PttShipmentInput } from ".."
import { isValidationError } from "../../../errors"
import { receiverOf } from "../../receiver"

const receiver = receiverOf({
  first_name: "Ayşe",
  last_name: "Yılmaz",
  phone: "05321234567",
  address_1: "Atatürk Cad. No: 5",
  address_2: "Caferağa Mah.",
  city: "Kadıköy",
  province: "İstanbul",
})

const input = (over: Partial<PttShipmentInput> = {}): PttShipmentInput => ({
  barcode: pttBarcodeOf("275036569845"),
  reference: "QTABCDEFGHJKLMNP",
  receiver,
  parcel: { weight_kg: 0.45, length_cm: 35, width_cm: 8, height_cm: 4 },
  cashOnDelivery: null,
  ...over,
})

describe("PTT barcodes", () => {
  it("works out the check digit as PTT's document does", () => {
    // PTT's own example (Veri Yükleme Web Servisi, 2016)
    expect(pttCheckDigit("275036569845")).toBe("6")
    expect(pttBarcodeOf("275036569845")).toBe("2750365698456")
    // A sum already a multiple of ten: 0
    expect(pttCheckDigit("000000000000")).toBe("0")
    expect(pttCheckDigit("100000000003")).toBe("0")
    expect(() => pttCheckDigit("12345")).toThrow()
  })

  it("tells a barcode with the right check digit, and counts a range", () => {
    expect(isPttBarcode("2750365698456")).toBe(true)
    expect(isPttBarcode("2750365698457")).toBe(false)
    expect(isPttBarcode("275036569845")).toBe(false)
    expect(serialOf(42)).toBe("000000000042")
    expect(rangeSize("275036569000", "275036569999")).toBe(1000)
  })

  it("warns under 50 numbers or 10 % of the ranges", () => {
    expect(barcodesLow(49, 10_000)).toBe(true)
    expect(barcodesLow(999, 10_000)).toBe(true)
    expect(barcodesLow(1000, 10_000)).toBe(false)
    expect(barcodesLow(60, 100)).toBe(false)
  })
})

describe("PTT account", () => {
  it("reads the customer number from the settings and the password from the secrets", () => {
    expect(
      pttCredentialsOf({
        settings: { customer_id: "123456789", test_mode: true },
        secrets: { password: "gizli" },
      })
    ).toEqual({ customerId: "123456789", password: "gizli", testMode: true })
    expect(pttCredentialsOf({ settings: { customer_id: "12" }, secrets: { password: "x" } })).toBe(
      null
    )
    expect(pttCredentialsOf({ settings: { customer_id: "123456789" }, secrets: {} })).toBe(null)
    expect(pttCredentialsOf(null)).toBe(null)
  })
})

describe("PTT parcel fields", () => {
  it("sends grams, desi and centimetres in PTT's field order, no e-mail, the mobile without 0", () => {
    const fields = pttShipmentFields(input())
    expect(Object.keys(fields)).toEqual([
      "aAdres",
      "agirlik",
      "aliciAdi",
      "aliciIlAdi",
      "aliciIlceAdi",
      "aliciSms",
      "barkodNo",
      "boy",
      "deger_ucreti",
      "desi",
      "ekhizmet",
      "en",
      "musteriReferansNo",
      "odeme_sart_ucreti",
      "odemesekli",
      "ucret",
      "yukseklik",
    ])
    expect(fields).toMatchObject({
      aAdres: "Caferağa Mah., Atatürk Cad. No: 5",
      agirlik: 450,
      aliciAdi: "Ayşe Yılmaz",
      aliciIlAdi: "İstanbul",
      aliciIlceAdi: "Kadıköy",
      aliciSms: "5321234567",
      barkodNo: "2750365698456",
      desi: 0.38,
      ekhizmet: undefined,
      odeme_sart_ucreti: 0,
      odemesekli: "MH",
    })
    expect(JSON.stringify(fields)).not.toContain("@")
  })

  it("asks PTT to collect at the door with the OS service and the amount in lira", () => {
    const fields = pttShipmentFields(input({ cashOnDelivery: 125_990 }))
    expect(fields).toMatchObject({ ekhizmet: "OS", odeme_sart_ucreti: "1259.90" })
  })

  it("leaves the measures to the branch for a parcel not measured", () => {
    const fields = pttShipmentFields(input({ parcel: null }))
    expect(fields).toMatchObject({ agirlik: undefined, desi: undefined, en: undefined })
  })

  it("stops a receiver name PTT refuses before sending anything", () => {
    let thrown: unknown
    try {
      pttShipmentFields(input({ receiver: { ...receiver, name: "Ali" } }))
    } catch (error) {
      thrown = error
    }
    expect(isValidationError(thrown)).toBe(true)
    expect(thrown).toMatchObject({ safeMessage: "ptt.receiver_name_short" })
  })
})

describe("PTT status", () => {
  const event = (statusId: string | null, said: string | null = null): PttEvent => ({
    statusId,
    said,
    at: null,
  })
  const statusOf = (...events: PttEvent[]) =>
    pttStatusOf({ found: events.length > 0, events }, "2750365698456").status

  it("follows the status ids to delivered", () => {
    expect(statusOf()).toBe("created")
    expect(statusOf(event("1"))).toBe("picked_up")
    expect(statusOf(event("1"), event("77"))).toBe("in_transit")
    expect(statusOf(event("1"), event("77"), event("7"))).toBe("out_for_delivery")
    expect(statusOf(event("1"), event("77"), event("7"), event("100"))).toBe("delivered")
  })

  it("keeps a failed delivery attempt on its way, and only a lasting loss failed", () => {
    expect(statusOf(event("1"), event("7"), event("532"))).toBe("out_for_delivery")
    expect(statusOf(event("1"), event("7"), event("118"))).toBe("in_transit")
    expect(statusOf(event("1"), event("999999", "Alıcı adreste yok, teslim edilemedi"))).toBe(
      "in_transit"
    )
    expect(statusOf(event("1"), event("180"))).toBe("failed")
  })

  it("reads returns and cancels, and lets fee events move nothing", () => {
    expect(statusOf(event("1"), event("99"))).toBe("returned")
    expect(statusOf(event("1"), event("120"))).toBe("returned")
    expect(statusOf(event("2"))).toBe("canceled")
    expect(statusOf(event("1"), event("100"), event("399"))).toBe("delivered")
    expect(statusOf(event("1"), event(null, "Göndericisine teslim edildi"))).toBe("returned")
  })

  it("links PTT's page by the barcode, or the fake's on a developer's machine", () => {
    expect(pttTrackingUrl("2750365698456")).toBe(
      "https://gonderitakip.ptt.gov.tr/Track/Verify?q=2750365698456"
    )
    expect(pttTrackingUrl("2750365698456", "http://127.0.0.1:9112")).toBe(
      "http://127.0.0.1:9112/takip/2750365698456"
    )
  })
})
