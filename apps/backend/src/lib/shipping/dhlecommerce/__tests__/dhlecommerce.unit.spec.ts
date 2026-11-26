import {
  DHL_ECOMMERCE_DEV_APP,
  DHL_ECOMMERCE_TAX,
  dhlEcomAppOf,
  dhlEcomBarcodeBody,
  dhlEcomCredentialsOf,
  dhlEcomFault,
  dhlEcomGatewayCode,
  dhlEcomOrderBody,
  dhlEcomPhone,
  dhlEcomStatusOf,
  findPlace,
  foldPlace,
  oneOf,
  wholeUp,
} from ".."
import type { DhlEcomDelivery, DhlEcomShipmentInput } from ".."
import { ANONYMOUS_TCKN } from "../../../invoicing/types"
import { receiverOf } from "../../receiver"

const input = (cashOnDelivery: number | null = null): DhlEcomShipmentInput => ({
  referenceId: "QTABCDEFGH234567",
  orderNumber: "1042",
  receiver: receiverOf({
    first_name: "Ayşe",
    last_name: "Yılmaz",
    phone: "+905321234567",
    address_1: "Atatürk Cad. No: 5",
    address_2: "Moda Mah.",
    city: "Kadıköy",
    province: "İstanbul",
    country_code: "tr",
  }),
  email: "ayse@example.com",
  cityCode: 34,
  districtCode: 3423,
  desi: 2,
  kg: 1,
  cashOnDelivery,
})

const delivery = (overrides: Partial<DhlEcomDelivery> = {}): DhlEcomDelivery => ({
  found: true,
  code: 2,
  status: "Transfer Aşamasında",
  shipmentId: "100000000001",
  trackingUrl: null,
  ...overrides,
})

describe("DHL eCommerce's bodies (docs/entegrasyonlar/dhlecommerce.md)", () => {
  it("sends the receiver by name only, ten-digit mobile, DHL's place codes, as a person", () => {
    const { order, recipient, orderPieceList } = dhlEcomOrderBody(input())

    expect(recipient).toMatchObject({
      fullName: "Ayşe Yılmaz",
      refCustomerId: "",
      cityCode: 34,
      cityName: "İstanbul",
      districtCode: 3423,
      districtName: "Kadıköy",
      address: "Moda Mah., Atatürk Cad. No: 5",
      mobilePhoneNumber: "5321234567",
      email: "ayse@example.com",
      taxNumber: ANONYMOUS_TCKN,
      taxOffice: "SAHIS",
    })
    expect(recipient).not.toHaveProperty("customerId")
    expect(order).toMatchObject({
      referenceId: "QTABCDEFGH234567",
      barcode: "QTABCDEFGH234567",
      isCOD: 0,
      codAmount: 0,
      paymentType: 1,
      deliveryType: 1,
      smsPreference1: 0,
    })
    expect(orderPieceList).toEqual([
      { barcode: "QTABCDEFGH234567_PARCA1", desi: 2, kg: 1, content: "Sipariş 1042" },
    ])
  })

  it("collects at the door in lira with a dot, on the order and the barcode alike", () => {
    expect(dhlEcomOrderBody(input(24_990)).order).toMatchObject({ isCOD: 1, codAmount: 249.9 })
    expect(dhlEcomBarcodeBody(input(24_990))).toMatchObject({
      referenceId: "QTABCDEFGH234567",
      isCOD: 1,
      codAmount: 249.9,
      packagingType: 3,
    })
  })

  it("never sends a customer's real tax id: the anonymous TCKN the e-Arşiv uses", () => {
    expect(DHL_ECOMMERCE_TAX).toEqual({ taxNumber: "11111111111", taxOffice: "SAHIS" })
  })

  it("writes numbers as DHL takes them", () => {
    expect(dhlEcomPhone("05321234567")).toBe("5321234567")
    expect(dhlEcomPhone("+90 532 123 45 67")).toBe("5321234567")
    expect(dhlEcomPhone("5321234567")).toBe("5321234567")
    expect(wholeUp(0.4)).toBe(1)
    expect(wholeUp(2)).toBe(2)
    expect(wholeUp(2.01)).toBe(3)
  })
})

describe("DHL eCommerce's il and ilçe names", () => {
  it("folds DHL's plate-suffixed capitals and ours alike", () => {
    expect(foldPlace("İSTANBUL  34")).toBe("istanbul")
    expect(foldPlace("İstanbul")).toBe("istanbul")
    expect(foldPlace("ŞİŞLİ")).toBe(foldPlace("Şişli"))
    expect(foldPlace("Eyüpsultan")).toBe("eyupsultan")
    expect(foldPlace("KAHRAMANMARAŞ 46")).toBe("kahramanmaras")
  })

  it("finds a place by name, and nothing for an empty or unknown one", () => {
    const list = [
      { code: 34, name: "İSTANBUL  34" },
      { code: 6, name: "ANKARA  06" },
    ]
    expect(findPlace(list, "istanbul")?.code).toBe(34)
    expect(findPlace(list, "")).toBeNull()
    expect(findPlace(list, "Mars")).toBeNull()
  })
})

describe("DHL eCommerce's answers", () => {
  it("reads one object whether DHL wraps it in an array or not", () => {
    expect(oneOf([{ jwt: "x" }])).toEqual({ jwt: "x" })
    expect(oneOf({ jwt: "x" })).toEqual({ jwt: "x" })
    expect(oneOf([])).toBeNull()
    expect(oneOf("x")).toBeNull()
  })

  it("reads a refusal's code and sentence in either case", () => {
    expect(
      dhlEcomFault({ error: { code: "20001", description: "VARIŞ ŞUBESİ BULUNAMADI" } })
    ).toEqual({ code: "20001", text: "VARIŞ ŞUBESİ BULUNAMADI" })
    expect(dhlEcomFault([{ Error: { Code: 3002, Message: "VAR" } }])).toEqual({
      code: "3002",
      text: "VAR",
    })
    expect(dhlEcomFault({ httpCode: "401" })).toBeUndefined()
  })

  it("tells the app's missing subscription from other gateway refusals", () => {
    expect(
      dhlEcomGatewayCode({
        httpCode: "401",
        moreInformation: "Cannot find valid subscription for the incoming API request.",
      })
    ).toBe("subscription_missing")
    expect(dhlEcomGatewayCode({ moreInformation: "Invalid token." })).toBeUndefined()
  })
})

describe("DHL eCommerce's status codes", () => {
  it("maps 1–7 to our statuses, a failed delivery staying on its way", () => {
    const status = (code: number) => dhlEcomStatusOf(delivery({ code })).status

    expect([1, 2, 3, 4, 5, 6, 7].map(status)).toEqual([
      "created",
      "in_transit",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "in_transit",
      "returned",
    ])
    // Support needed, an unknown code or an unknown reference: nothing moves
    expect(status(8)).toBe("created")
    expect(status(99)).toBe("created")
    expect(dhlEcomStatusOf(delivery({ found: false, code: 5 })).status).toBe("created")
  })

  it("links DHL's own page from its hosts only, else its public page; a fake's own page", () => {
    const linked = (trackingUrl: string) => dhlEcomStatusOf(delivery({ trackingUrl })).tracking_url

    expect(linked("https://track.dhlecommerce.com.tr/x?id=1")).toBe(
      "https://track.dhlecommerce.com.tr/x?id=1"
    )
    expect(linked("https://kargotakip.mngkargo.com.tr/?q=1")).toBe(
      "https://kargotakip.mngkargo.com.tr/?q=1"
    )
    expect(linked("http://track.dhlecommerce.com.tr/x")).toBe(
      "https://www.dhlecommerce.com.tr/gonderitakip"
    )
    expect(linked("https://evil.example/dhlecommerce.com.tr")).toBe(
      "https://www.dhlecommerce.com.tr/gonderitakip"
    )
    expect(dhlEcomStatusOf(delivery(), "http://127.0.0.1:9110").tracking_url).toBe(
      "http://127.0.0.1:9110/takip/100000000001"
    )
    expect(dhlEcomStatusOf(delivery({ shipmentId: null })).tracking_url).toBeNull()
  })
})

describe("DHL eCommerce's accounts", () => {
  it("reads the shop's customer number and password, and the platform's app", () => {
    expect(
      dhlEcomCredentialsOf({
        settings: { test_mode: true },
        secrets: { customer_number: "123", password: "p" },
      })
    ).toEqual({ customerNumber: "123", password: "p", testMode: true })
    expect(dhlEcomCredentialsOf({ settings: {}, secrets: { customer_number: "123" } })).toBeNull()
    expect(dhlEcomAppOf({})).toBeNull()
    expect(
      dhlEcomAppOf({ DHL_ECOMMERCE_CLIENT_ID: "id", DHL_ECOMMERCE_CLIENT_SECRET: "s" })
    ).toEqual({ clientId: "id", clientSecret: "s" })
    // Half an app is none
    expect(dhlEcomAppOf({ DHL_ECOMMERCE_CLIENT_ID: "id" })).toBeNull()
    expect(dhlEcomAppOf({ DHL_ECOMMERCE_BASE_URL: "http://127.0.0.1:9110" })).toBe(
      DHL_ECOMMERCE_DEV_APP
    )
  })
})
