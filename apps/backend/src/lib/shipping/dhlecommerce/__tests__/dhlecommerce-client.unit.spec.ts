import { startFakeDhlEcom } from "@qticaret/testing"
import type { FakeDhlEcom } from "@qticaret/testing"
import { createDhlEcomApi } from ".."
import type { DhlEcomApi, DhlEcomCredentials, DhlEcomShipmentInput } from ".."
import { receiverOf } from "../../receiver"

let fake: FakeDhlEcom
let api: DhlEcomApi
let account: DhlEcomCredentials
const sleeps: number[] = []
// The il/ilçe lists: the live host, the platform's app
const PUBLIC = { testMode: false, app: null }

const shipment = async (
  referenceId: string,
  cashOnDelivery: number | null = null,
  street = "Atatürk Cad. No: 5"
) => {
  const places = await api.placeCodes(PUBLIC, "İstanbul", "Kadıköy")
  return {
    referenceId,
    orderNumber: "1042",
    receiver: receiverOf({
      first_name: "Ayşe",
      last_name: "Yılmaz",
      phone: "05321234567",
      address_1: street,
      city: "Kadıköy",
      province: "İstanbul",
    }),
    email: "ayse@example.com",
    ...places,
    desi: 2,
    kg: 1,
    cashOnDelivery,
  } satisfies DhlEcomShipmentInput
}

beforeAll(async () => {
  fake = await startFakeDhlEcom()
})

afterAll(async () => {
  await fake.close()
})

beforeEach(() => {
  api = createDhlEcomApi({
    baseUrl: fake.url,
    app: () => fake.app,
    branchWaitsMs: [5, 10],
    sleep: (ms) => {
      sleeps.push(ms)
      return Promise.resolve()
    },
    retry: { attempts: 1 },
  })
  account = { ...fake.account, testMode: true, app: null }
  sleeps.length = 0
  fake.requests.length = 0
})

describe("DHL eCommerce's client against the fake (docs/entegrasyonlar/dhlecommerce.md)", () => {
  it("opens a parcel in three steps and gets its barcode and Zebra label", async () => {
    const input = await shipment("QTTHREESTEPS2345", 24_990)

    await api.createRecipient(account, input)
    await api.createOrder(account, input)
    const made = await api.createBarcode(account, input)

    expect(made.shipmentId).toMatch(/^\d{12}$/)
    expect(made.pieces[0]?.barcode).toMatch(/^C@/)
    expect(made.pieces[0]?.zpl).toMatch(/^\^XA/)
    expect(fake.orders.get("QTTHREESTEPS2345")).toMatchObject({
      recipientName: "Ayşe Yılmaz",
      phone: "5321234567",
      taxNumber: "11111111111",
      isCOD: 1,
      codAmount: 249.9,
    })
    // One token for the three calls; the place lists asked without one
    expect(fake.requests.filter(({ path }) => path.endsWith("/token"))).toHaveLength(1)
  })

  it("waits while DHL looks for the branch (20001), then gives up with its code", async () => {
    const input = await shipment("QTNORECIPIENT234", null, "Bağdat Cad. No: 9")
    await api.createOrder(account, input)

    await expect(api.createBarcode(account, input)).rejects.toMatchObject({
      providerCode: "error_20001",
      providerMessage: "VARIŞ ŞUBESİ BULUNAMADI",
    })
    expect(sleeps).toEqual([5, 10])

    sleeps.length = 0
    await api.createRecipient(account, input)
    fake.queue("createbarcode", "20001")
    expect((await api.createBarcode(account, input)).shipmentId).toMatch(/^\d{12}$/)
    expect(sleeps).toEqual([5])
  })

  it("takes an order DHL already has (3002) as opened", async () => {
    const input = await shipment("QTTWICE234567890")
    await api.createOrder(account, input)

    await expect(api.createOrder(account, input)).resolves.toBeUndefined()
  })

  it("asks for a new token once DHL refuses the kept one", async () => {
    const input = await shipment("QTEXPIRED2345678")
    await api.createRecipient(account, input)
    fake.expireTokens()

    await api.createOrder(account, input)

    expect(fake.requests.filter(({ path }) => path.endsWith("/token"))).toHaveLength(2)
    expect(fake.orders.has("QTEXPIRED2345678")).toBe(true)
  })

  it("withdraws the barcode, then the order; refuses once the branch has it", async () => {
    const input = await shipment("QTCANCEL23456789")
    await api.createRecipient(account, input)
    await api.createOrder(account, input)
    const made = await api.createBarcode(account, input)

    await expect(api.cancelOrder(account, input.referenceId)).rejects.toMatchObject({
      providerCode: "error_30021",
    })
    await api.cancelShipment(account, input.referenceId, made.shipmentId)
    await api.cancelOrder(account, input.referenceId)
    expect(fake.orders.get(input.referenceId)).toMatchObject({
      barcodeCanceled: true,
      canceled: true,
    })

    const taken = await shipment("QTTAKEN234567890")
    await api.createRecipient(account, taken)
    await api.createOrder(account, taken)
    const kept = await api.createBarcode(account, taken)
    await api.status(account, taken.referenceId)
    await expect(
      api.cancelShipment(account, taken.referenceId, kept.shipmentId)
    ).rejects.toMatchObject({ providerCode: "error_30020" })
  })

  it("reads where the parcel stands, and nothing for a reference DHL does not know", async () => {
    const input = await shipment("QTSTATUS23456789")
    await api.createRecipient(account, input)
    await api.createOrder(account, input)
    const made = await api.createBarcode(account, input)

    const read = await api.status(account, input.referenceId)

    expect(read).toMatchObject({ found: true, code: 2, shipmentId: made.shipmentId })
    expect((await api.status(account, "QTNOSUCH23456789")).found).toBe(false)
  })

  it("refuses an il or ilçe DHL does not list, naming the field", async () => {
    await expect(api.placeCodes(PUBLIC, "Mars", "Kadıköy")).rejects.toMatchObject({
      safeMessage: "dhlecommerce.place_unknown",
      field: "shipping_address.province",
    })
    await expect(api.placeCodes(PUBLIC, "İstanbul", "Atlantis")).rejects.toMatchObject({
      field: "shipping_address.city",
    })
  })

  it("calls with the shop's own app in place of the platform's, which then may be missing", async () => {
    const without = createDhlEcomApi({ baseUrl: fake.url, app: () => null })
    const wrongPlatform = createDhlEcomApi({
      baseUrl: fake.url,
      app: () => ({ clientId: "baska-uygulama", clientSecret: "baska-uygulama-sirri" }),
      retry: { attempts: 1 },
    })
    const own = { ...account, app: { ...fake.app } }

    expect(await without.checkLogin(own)).toBe("valid")
    expect(await wrongPlatform.checkLogin(own)).toBe("valid")
    // Without its own keys the account goes with the platform's app, which DHL refuses here
    await expect(wrongPlatform.checkLogin(account)).resolves.not.toBe("valid")
  })

  it("checks the shop's login: a wrong password is the shop's, a missing subscription is not", async () => {
    expect(await api.checkLogin(account)).toBe("valid")
    expect(await api.checkLogin({ ...account, password: "yanlis-sifre" })).toBe("secret_invalid")

    fake.unsubscribe("identity")
    await expect(api.checkLogin(account)).rejects.toMatchObject({
      providerCode: "subscription_missing",
    })
  })

  it("is unavailable without the platform's app", async () => {
    const without = createDhlEcomApi({ baseUrl: fake.url, app: () => null })

    await expect(without.checkLogin(account)).rejects.toMatchObject({
      safeMessage: "dhlecommerce.unavailable",
    })
  })
})
