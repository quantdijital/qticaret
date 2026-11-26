import { startFakeSurat } from "@qticaret/testing"
import type { FakeSurat } from "@qticaret/testing"
import { createSuratApi, suratCredentialsOf } from ".."
import type { SuratApi, SuratCredentials, SuratShipmentInput } from ".."
import { isProviderError, isValidationError } from "../../../errors"
import { cancelSuratParcel, openSuratParcel } from "../../../../modules/fulfillment-surat/ship"
import { receiverOf } from "../../receiver"

let fake: FakeSurat
let api: SuratApi
let account: SuratCredentials
// The Integrations page's log of failures is not what these specs read
const quiet = { note: () => Promise.resolve(), recent: () => Promise.resolve([]) }

const input = (code: string, cashOnDelivery: number | null = null): SuratShipmentInput => ({
  code,
  orderNumber: "1042",
  receiver: receiverOf({
    first_name: "Ayşe",
    last_name: "Yılmaz",
    phone: "05321234567",
    address_1: "Atatürk Cad. No: 5",
    city: "Kadıköy",
    province: "İstanbul",
  }),
  desi: 0.4,
  kg: 0.45,
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

function withCari(): SuratCredentials {
  const credentials = suratCredentialsOf({
    settings: {},
    secrets: {
      username: fake.accounts.shipping.username,
      password: fake.accounts.shipping.password,
      cari_code: fake.accounts.tracking.cariCode,
      web_password: fake.accounts.tracking.webPassword,
    },
  })
  if (!credentials) {
    throw new Error("the fake's account reads as no account")
  }
  return credentials
}

beforeAll(async () => {
  fake = await startFakeSurat()
})

afterAll(async () => {
  await fake.close()
})

beforeEach(() => {
  api = createSuratApi({ baseUrl: fake.url, retry: { attempts: 1 }, failureLog: () => quiet })
  account = withCari()
  fake.shipments.clear()
  fake.requests.length = 0
})

describe("Sürat client against the fake service", () => {
  it("opens a parcel under our code, collects at the door, and tracks it by the cari pair", async () => {
    await api.createShipment(account, input("QTSURAT000000001", 125_990))
    await api.createShipment(account, input("QTSURAT000000099"))
    // Pinned before the branch has it: Sürat lists nothing
    fake.hold("QTSURAT000000099")
    const before = await api.track(account, "QTSURAT000000099")
    const after = await api.track(account, "QTSURAT000000001")
    const sent = fake.shipments.get("QTSURAT000000001")
    const trackBody = fake.requests.find((r) => r.operation === "KargoTakipHareketDetayi")?.body

    expect(sent).toMatchObject({ collectionType: "1", codAmount: "1259.90", phone: "5321234567" })
    // Nothing before the branch has it; then its movements
    expect(before.found).toBe(false)
    expect(after.found).toBe(true)
    expect(after.rows[0]).toMatchObject({ HAREKETTIPI: "KargoSubedeTeslimAlindi" })
    expect(trackBody).toContain(`<CariKodu>${fake.accounts.tracking.cariCode}</CariKodu>`)
    expect(trackBody).not.toContain(fake.accounts.shipping.password)
  })

  it("refuses a parcel on any sentence but a known success, keeping Sürat's words without secrets", async () => {
    fake.queue("GonderiyiKargoyaGonderYeni", `say:Hatalı kullanıcı ${account.shipping.username}`)

    const error = await failure(() => api.createShipment(account, input("QTSURAT000000002")))

    expect(isProviderError(error) && error.providerCode).toBe("rejected")
    expect(isProviderError(error) && error.providerMessage).toMatch(/^Hatalı kullanıcı \*\*\*$/)
  })

  it("deletes a parcel before the branch has it, and asks it back after", async () => {
    await api.createShipment(account, input("QTSURAT000000003"))
    await api.remove(account, "QTSURAT000000003")
    await api.createShipment(account, input("QTSURAT000000004"))
    await api.track(account, "QTSURAT000000004")

    const refused = await failure(() => api.remove(account, "QTSURAT000000004"))
    await api.withdraw(account, "QTSURAT000000004")

    expect(fake.shipments.get("QTSURAT000000003")?.canceled).toBe(true)
    expect(isProviderError(refused) && refused.providerCode).toBe("rejected")
    expect(fake.shipments.get("QTSURAT000000004")?.withdrawn).toBe(true)
  })

  it("gives Sürat's PDF label only to an account allowed one", async () => {
    await api.createShipment(account, input("QTSURAT000000005"))
    expect(await api.label(account, "QTSURAT000000005")).toBeNull()

    const allowed = await startFakeSurat(fake.accounts, { barcode: true })
    try {
      const other = createSuratApi({
        baseUrl: allowed.url,
        retry: { attempts: 1 },
        failureLog: () => quiet,
      })
      await other.createShipment(account, input("QTSURAT000000006"))
      const pdf = await other.label(account, "QTSURAT000000006")
      expect(
        Buffer.from(pdf ?? "", "base64")
          .subarray(0, 5)
          .toString()
      ).toBe("%PDF-")
    } finally {
      await allowed.close()
    }
  })

  it("checks the tracking login: a wrong web password is refused, an unknown code is not", async () => {
    expect(await api.checkLogin(account)).toBe("valid")
    expect(
      await api.checkLogin({
        ...account,
        tracking: { username: account.tracking.username, password: "yanlis-sifre" },
      })
    ).toBe("secret_invalid")
  })

  it("reads a SOAP fault as Sürat's refusal", async () => {
    fake.queue("GonderiSil", "fault")

    const error = await failure(() => api.remove(account, "QTSURAT000000007"))

    expect(isProviderError(error) ? error.providerCode : null).toMatch(/^error_/)
  })
})

describe("opening and cancelling a Sürat parcel (fulfillment-surat/ship)", () => {
  it("deletes a parcel an unknown sentence may have opened, then tells the failure", async () => {
    fake.queue("GonderiyiKargoyaGonderYeni", "open:Kayıt alındı, işleniyor")

    const error = await failure(() => openSuratParcel(api, account, input("QTSURAT000000010"), 7))

    expect(isProviderError(error) && error.providerMessage).toBe("Kayıt alındı, işleniyor")
    expect(fake.shipments.get("QTSURAT000000010")?.canceled).toBe(true)
  })

  it("withdraws a parcel whose answer never came", async () => {
    fake.queue("GonderiyiKargoyaGonderYeni", "lost")

    const error = await failure(() => openSuratParcel(api, account, input("QTSURAT000000011"), 7))

    expect(error).not.toBeNull()
    expect(fake.shipments.get("QTSURAT000000011")?.canceled).toBe(true)
  })

  it("asks staff to look at Sürat when a parcel may be open and cannot be deleted", async () => {
    fake.queue("GonderiyiKargoyaGonderYeni", "open:Bilinmeyen yanıt")
    fake.queue("GonderiSil", "say:Sistem meşgul")

    const error = await failure(() => openSuratParcel(api, account, input("QTSURAT000000012"), 7))

    expect(isValidationError(error) && error.safeMessage).toBe("surat.withdraw_failed")
  })

  it("leaves nothing to delete after a refusal: Sürat has no such parcel", async () => {
    fake.queue("GonderiyiKargoyaGonderYeni", "say:Alıcı bilgileri eksik")

    const error = await failure(() => openSuratParcel(api, account, input("QTSURAT000000013"), 7))

    expect(isProviderError(error) && error.providerMessage).toBe("Alıcı bilgileri eksik")
    expect(fake.shipments.size).toBe(0)
  })

  it("cancels by deleting, or by asking the parcel back once the branch has it", async () => {
    await api.createShipment(account, input("QTSURAT000000014"))
    await cancelSuratParcel(api, account, "QTSURAT000000014")
    await api.createShipment(account, input("QTSURAT000000015"))
    await api.track(account, "QTSURAT000000015")

    const kept = await failure(() => cancelSuratParcel(api, account, "QTSURAT000000015"))

    expect(fake.shipments.get("QTSURAT000000014")?.canceled).toBe(true)
    expect(isValidationError(kept) && kept.safeMessage).toBe("surat.withdraw_requested")
    expect(fake.shipments.get("QTSURAT000000015")?.withdrawn).toBe(true)
  })
})
