import { startFakeYurtici } from "@qticaret/testing"
import type { FakeYurtici } from "@qticaret/testing"
import { createYurticiApi, yurticiStatusOf } from ".."
import type { YurticiShipmentInput } from ".."
import { findFirst, parseXml } from "../../../clients/xml"
import { deliveryOf, withdrawalRefusal } from "../answers"
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

/** An answer's result element, in the shape the document's samples give, with made-up values. */
const body = (inner: string) => {
  const tree = parseXml(
    `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>${inner}</env:Body></env:Envelope>`
  )
  const result = findFirst(tree, "ShippingDeliveryVO") ?? findFirst(tree, "ShippingOrderResultVO")
  if (!result) {
    throw new Error("no result element")
  }
  return result
}

describe("Yurtiçi answers as the document gives them (adr/0035)", () => {
  it("reads an unknown key from its own line, which names no key, under outFlag 0", () => {
    const tree = body(
      `<ShippingDeliveryVO><outFlag>0</outFlag><outResult>Başarılı.</outResult><count>1</count><senderCustId>0</senderCustId><shippingDeliveryDetailVO><errCode>82519</errCode><errMessage>TEST kullanıcısına ait QTX kargo anahtarı bulunmamaktadır.</errMessage><jobId>0</jobId></shippingDeliveryDetailVO></ShippingDeliveryVO>`
    )

    expect(deliveryOf(tree, "QTX").found).toBe(false)
    expect(() =>
      deliveryOf(
        body(
          `<ShippingDeliveryVO><outFlag>0</outFlag><shippingDeliveryDetailVO><errCode>82527</errCode></shippingDeliveryDetailVO></ShippingDeliveryVO>`
        ),
        "QTX"
      )
    ).toThrow(expect.objectContaining({ providerCode: "error_82527" }) as Error)
  })

  it("reads the parcel's number from the line or its detail, and the return's code", () => {
    const delivery = deliveryOf(
      body(
        `<ShippingDeliveryVO><outFlag>0</outFlag><shippingDeliveryDetailVO><cargoKey>QTX</cargoKey><docId>100000000009</docId><operationCode>1</operationCode><operationMessage>Kargo Teslimattadır.</operationMessage><operationStatus>IND</operationStatus><shippingDeliveryItemDetailVO><cargoKey>QTX</cargoKey><cargoEventExplanation>Kargo İndirildi</cargoEventExplanation><rejectStatus>10</rejectStatus><rejectStatusExplanation>İade Sonlandırıldı</rejectStatusExplanation><returnStatus>3</returnStatus><returnStatusExplanation>Gönderici Müşteriye İade Edildi.</returnStatusExplanation></shippingDeliveryItemDetailVO></shippingDeliveryDetailVO></ShippingDeliveryVO>`
      ),
      "QTX"
    )

    expect(delivery).toMatchObject({
      found: true,
      operationStatus: "IND",
      docId: "100000000009",
      rejectStatus: "10",
      words: ["Kargo İndirildi"],
    })
    expect(yurticiStatusOf(delivery).status).toBe("returned")
  })

  it("takes only CNL, ISC and 82520 as withdrawn, whatever the code numbers say", () => {
    const answer = (line: string, outFlag = "0") =>
      body(
        `<ShippingOrderResultVO><outFlag>${outFlag}</outFlag><count>1</count><shippingCancelDetailVO><cargoKey>QTX</cargoKey><docId>0</docId><jobId>1</jobId>${line}</shippingCancelDetailVO></ShippingOrderResultVO>`
      )
    const op = (code: number, status: string) =>
      `<operationCode>${String(code)}</operationCode><operationStatus>${status}</operationStatus>`

    // The document's own sample: "Kargo Çıkışı Engellendi." as code 2, CNL
    expect(withdrawalRefusal(answer(op(2, "CNL")), "QTX")).toBeNull()
    expect(withdrawalRefusal(answer(op(4, "ISC")), "QTX")).toBeNull()
    expect(withdrawalRefusal(answer("<errCode>82520</errCode>", "1"), "QTX")).toBeNull()
    expect(withdrawalRefusal(answer(op(1, "IND")), "QTX")).toMatchObject({
      providerCode: "return_requested",
    })
    expect(withdrawalRefusal(answer(op(5, "DLV")), "QTX")).toMatchObject({
      providerCode: "status_dlv",
    })
    expect(withdrawalRefusal(answer(""), "QTX")).toMatchObject({ providerCode: "rejected" })
    expect(withdrawalRefusal(answer("<errCode>82519</errCode>", "1"), "QTX")).toMatchObject({
      providerCode: "error_82519",
    })
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
    expect(sent?.body).toContain("<userLanguage>TR</userLanguage>")
    expect(sent?.body).toContain("<dcCreditRule></dcCreditRule>")
    expect(fake.shipments.get("QTUNITKEY000001")).toMatchObject({
      account: "main",
      receiverName: "Ayşe Yılmaz",
      phone: "5321234567",
      city: "İstanbul",
      town: "Kadıköy",
      desi: "1.500",
      kg: "0.450",
    })
    expect(twice).toMatchObject({ providerCode: "error_60020" })
  })

  it("is refused what the document refuses", async () => {
    const refusal = (input: YurticiShipmentInput) =>
      api()
        .createShipment(fake.accounts.main, true, input)
        .catch((error: unknown) => error)
    const base = shipment("QTUNITKEY000009")

    expect(
      await refusal({ ...base, receiver: { ...base.receiver, phone: "053212345" } })
    ).toMatchObject({ providerCode: "error_82516" })
    expect(
      await refusal({ ...base, receiver: { ...base.receiver, address: "No 5" } })
    ).toMatchObject({
      providerCode: "error_82502",
    })
    expect(await refusal({ ...base, cargoKey: "QT".repeat(11) })).toMatchObject({
      providerCode: "error_82500",
    })
    expect(fake.shipments.has("QTUNITKEY000009")).toBe(false)
  })

  it("follows the parcel on the login that opened it only", async () => {
    await api().createShipment(fake.accounts.cod, true, shipment("QTUNITKEY000002", 10_000))

    const elsewhere = await api().query(fake.accounts.main, true, "QTUNITKEY000002")
    const first = await api().query(fake.accounts.cod, true, "QTUNITKEY000002")

    expect(elsewhere.found).toBe(false)
    expect(first).toMatchObject({ found: true, operationCode: 2, operationStatus: "ISR" })
    expect(yurticiStatusOf(first)).toMatchObject({
      status: "picked_up",
      tracking_number: expect.stringMatching(/^\d{12}$/) as string,
    })
    expect(fake.shipments.get("QTUNITKEY000002")).toMatchObject({
      account: "cod",
      codAmount: "100.00",
      codDocumentId: "1042",
      collectionType: "0",
    })
  })

  it("withdraws a parcel until its document is issued, again without harm; after, it is a return", async () => {
    await api().createShipment(fake.accounts.main, true, shipment("QTUNITKEY000003"))
    await api().query(fake.accounts.main, true, "QTUNITKEY000003")
    await api().cancel(fake.accounts.main, true, "QTUNITKEY000003")
    await api().cancel(fake.accounts.main, true, "QTUNITKEY000003")
    await api().createShipment(fake.accounts.main, true, shipment("QTUNITKEY000004"))
    await api().query(fake.accounts.main, true, "QTUNITKEY000004")
    await api().query(fake.accounts.main, true, "QTUNITKEY000004")

    const late = await api()
      .cancel(fake.accounts.main, true, "QTUNITKEY000004")
      .catch((error: unknown) => error)
    const after = await api().query(fake.accounts.main, true, "QTUNITKEY000004")
    const canceled = await api().query(fake.accounts.main, true, "QTUNITKEY000003")

    expect(fake.shipments.get("QTUNITKEY000003")?.canceled).toBe(true)
    expect(yurticiStatusOf(canceled).status).toBe("canceled")
    expect(late).toMatchObject({ providerCode: "return_requested" })
    expect(yurticiStatusOf(after).status).toBe("returned")
  })

  it("tells a login Yurtiçi takes from one it refuses", async () => {
    expect(await api().checkLogin(fake.accounts.main, true)).toBe("valid")
    expect(await api().checkLogin({ username: "yanlis", password: "yanlis-sifre" }, true)).toBe(
      "secret_invalid"
    )
  })

  it("takes a fault sent as HTTP 500 for Yurtiçi's refusal, not for a lost answer", async () => {
    fake.queue("createShipment", "fault:82516")

    const refused = await api()
      .createShipment(fake.accounts.main, true, shipment("QTUNITKEY000005"))
      .catch((error: unknown) => error)

    expect(refused).toMatchObject({ providerCode: "error_82516", retryable: false })
    expect(fake.shipments.has("QTUNITKEY000005")).toBe(false)
  })

  it("says nothing of the login on a 500 without a fault or on another fault", async () => {
    const answering = (status: number, text: string) =>
      createYurticiApi({
        baseUrl: fake.url,
        transport: () => Promise.resolve({ status, text, header: () => "text/xml; charset=utf-8" }),
      })
    fake.queue("queryShipment", "fault:82526")

    const otherFault = await api()
      .checkLogin(fake.accounts.main, true)
      .catch((error: unknown) => error)
    const plain = await answering(500, "")
      .checkLogin(fake.accounts.main, true)
      .catch((error: unknown) => error)

    expect(otherFault).toMatchObject({ providerCode: "error_82526" })
    expect(plain).toMatchObject({ providerCode: "http_500" })
  })
})
