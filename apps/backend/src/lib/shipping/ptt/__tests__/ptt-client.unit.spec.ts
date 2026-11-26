import { startFakePtt } from "@qticaret/testing"
import type { FakePtt } from "@qticaret/testing"
import { createPttApi, pttBarcodeOf, pttCredentialsOf, pttFileName } from ".."
import type { PttApi, PttCredentials, PttShipmentInput } from ".."
import { isProviderError, isValidationError } from "../../../errors"
import { cancelPttParcel, openPttParcel } from "../../../../modules/fulfillment-ptt/ship"
import { receiverOf } from "../../receiver"

let fake: FakePtt
let api: PttApi
let account: PttCredentials
let serial = 275036569000
// The Integrations page's log of failures is not what these specs read
const quiet = { note: () => Promise.resolve(), recent: () => Promise.resolve([]) }

const nextBarcode = () => pttBarcodeOf(String((serial += 1)))

const input = (barcode: string, cashOnDelivery: number | null = null): PttShipmentInput => ({
  barcode,
  reference: `QT${barcode.slice(0, 14)}`,
  receiver: receiverOf({
    first_name: "Ayşe",
    last_name: "Yılmaz",
    phone: "05321234567",
    address_1: "Atatürk Cad. No: 5",
    city: "Kadıköy",
    province: "İstanbul",
  }),
  parcel: { weight_kg: 0.45, length_cm: 35, width_cm: 8, height_cm: 4 },
  cashOnDelivery,
})

const failure = async (run: () => Promise<unknown>) => {
  try {
    await run()
  } catch (error) {
    return error
  }
  return null
}

const credentials = (over: Partial<{ password: string; test: boolean }> = {}): PttCredentials => {
  const read = pttCredentialsOf({
    settings: { customer_id: fake.account.customerId, test_mode: over.test ?? false },
    secrets: { password: over.password ?? fake.account.password },
  })
  if (!read) {
    throw new Error("the fake's account reads as no account")
  }
  return read
}

beforeAll(async () => {
  fake = await startFakePtt()
})

afterAll(async () => {
  await fake.close()
})

beforeEach(() => {
  api = createPttApi({ baseUrl: fake.url, retry: { attempts: 1 }, failureLog: () => quiet })
  account = credentials()
  fake.shipments.clear()
  fake.requests.length = 0
})

describe("PTT client against the fake services", () => {
  it("loads a parcel under its barcode with namespaced fields, and tracks it over SOAP 1.2", async () => {
    const barcode = nextBarcode()
    await api.upload(account, input(barcode, 125_990), pttFileName("QTONE"))
    const first = await api.track(account, barcode)
    const second = await api.track(account, barcode)

    const [upload] = fake.requests
    expect(upload?.body).toContain('xmlns:ax="http://kabul.ptt.gov.tr/xsd"')
    expect(upload?.body).toContain("<op:input><ax:dongu><ax:aAdres>")
    expect(upload?.body).toContain("<ax:kullanici>PttWs</ax:kullanici>")
    expect(upload?.contentType).toMatch(/^text\/xml/)
    expect(fake.requests[1]?.contentType).toMatch(/^application\/soap\+xml.*urn:gonderiSorgu2/)
    expect(fake.shipments.get(barcode)).toMatchObject({
      services: "OS",
      codAmount: "1259.90",
      grams: "450",
      phone: "5321234567",
      test: false,
    })
    expect(first).toEqual({
      found: true,
      events: [{ statusId: "1", said: "Kabul Edildi", at: expect.any(String) as unknown }],
    })
    expect(second.events.map((event) => event.statusId)).toEqual(["1", "77"])
    // The receiver's and sender's names PTT sends with every answer are not kept
    expect(JSON.stringify(second)).not.toMatch(/AY\*\*|ANA DEPO/)
  })

  it("uses PTT's test services in test mode", async () => {
    const barcode = nextBarcode()
    await api.upload(credentials({ test: true }), input(barcode), pttFileName("QTTEST"))
    expect(fake.requests[0]?.test).toBe(true)
    expect(fake.shipments.get(barcode)?.test).toBe(true)
  })

  it("refuses a barcode used twice and a file name used twice, with PTT's words", async () => {
    const barcode = nextBarcode()
    await api.upload(account, input(barcode), "QTDUP-1")
    const twice = await failure(() => api.upload(account, input(barcode), "QTDUP-2"))
    const sameFile = await failure(() => api.upload(account, input(nextBarcode()), "QTDUP-1"))

    expect(twice).toMatchObject({
      providerCode: "ptt_-10",
      providerMessage: expect.stringMatching(/Barkod/) as unknown,
    })
    expect(sameFile).toMatchObject({ providerCode: "ptt_-3" })
  })

  it("checks the account by tracking a barcode nobody has", async () => {
    expect(await api.checkLogin(account)).toBe("valid")
    expect(await api.checkLogin(credentials({ password: "yanlis-sifre" }))).toBe("secret_invalid")
  })

  it("deletes a lost upload at once, and says so when PTT keeps it", async () => {
    const barcode = nextBarcode()
    fake.queue("kabulEkle2", "lost")
    const lost = await failure(() =>
      openPttParcel(api, account, input(barcode), pttFileName("QTLOST"), 1001)
    )
    expect(isProviderError(lost)).toBe(true)
    expect(fake.shipments.get(barcode)?.canceled).toBe(true)

    const kept = nextBarcode()
    fake.queue("kabulEkle2", "lost")
    fake.queue("barkodVeriSil", "code:0:Sistem hatası")
    const stuck = await failure(() => openPttParcel(api, account, input(kept), "QTKEPT-1", 1002))
    expect(isValidationError(stuck)).toBe(true)
    expect(stuck).toMatchObject({ safeMessage: "ptt.withdraw_failed" })
  })

  it("deletes nothing after PTT's own refusal: nothing was loaded", async () => {
    fake.queue("kabulEkle2", "code:-5:Ek hizmet tanımlı değil")
    const refused = await failure(() =>
      openPttParcel(api, account, input(nextBarcode()), "QTREF-1", 1003)
    )
    expect(refused).toMatchObject({
      providerCode: "ptt_-5",
      providerMessage: "Ek hizmet tanımlı değil",
    })
    expect(fake.requests.map((each) => each.operation)).toEqual(["kabulEkle2"])
  })

  it("deletes a parcel before acceptance, and refuses once a branch has it", async () => {
    const early = nextBarcode()
    await api.upload(account, input(early), "QTCANCEL-1")
    await cancelPttParcel(api, account, early, "QTCANCEL-1")
    expect(fake.shipments.get(early)?.canceled).toBe(true)

    const late = nextBarcode()
    await api.upload(account, input(late), "QTCANCEL-2")
    const shipment = fake.shipments.get(late)
    if (shipment) {
      shipment.step = 0
    }
    const refused = await failure(() => cancelPttParcel(api, account, late, "QTCANCEL-2"))
    expect(refused).toMatchObject({ safeMessage: "ptt.already_accepted" })
    expect(fake.shipments.get(late)?.canceled).toBe(false)
  })

  it("masks the account in what PTT quotes back", async () => {
    fake.queue("kabulEkle2", `code:-9:Hatalı şifre ${fake.account.password}`)
    const refused = await failure(() => api.upload(account, input(nextBarcode()), "QTMASK-1"))
    expect(JSON.stringify(refused)).not.toContain(fake.account.password)
  })
})
