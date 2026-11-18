import { fakeGeliverToken, startFakeGeliver } from "@qticaret/testing"
import type { FakeGeliver } from "@qticaret/testing"
import { isProviderError } from "../../../errors"
import { createGeliverApi } from "../client"
import type { GeliverApi, GeliverSenderInput } from "../client"
import { geliverCredentialsOf } from "../credentials"
import { geliverErrorCode } from "../errors"

const codeOf = async (run: Promise<unknown>): Promise<string> => {
  try {
    await run
  } catch (error) {
    return isProviderError(error) ? error.providerCode : String(error)
  }
  return "no error"
}

const SENDER: GeliverSenderInput = {
  name: "Örnek Mağaza",
  email: "depo@example.com",
  phone: "+905551112233",
  address1: "Atatürk Cad. No: 1",
  countryCode: "TR",
  cityName: "İstanbul",
  cityCode: "34",
  districtName: "Kadıköy",
  zip: "34710",
  shortName: "qt-sloc_1",
}

describe("Geliver client against the fake server (adr/0031)", () => {
  let fake: FakeGeliver
  let api: GeliverApi
  const credentials = () => ({ token: fake.token, testMode: true })

  beforeEach(async () => {
    fake = await startFakeGeliver()
    api = createGeliverApi({
      baseUrl: fake.url,
      // No case here is about the client timeout. With 500 ms a busy CI runner timed
      // a local answer out (a cold first POST took 613 ms): the create then failed as
      // outcome_unknown, or a read was asked again and the retry missed the answer a
      // case had queued ("no error" instead of error_LIMIT)
      timeoutMs: 10_000,
      retry: { baseDelayMs: 1 },
      sleep: () => Promise.resolve(),
    })
  })

  afterEach(async () => {
    await fake.close()
  })

  it("knows the shop's token, and says when Geliver refuses it", async () => {
    expect(await api.checkCredentials(credentials())).toBe("valid")
    expect(await api.checkCredentials({ token: fakeGeliverToken(), testMode: true })).toBe(
      "secret_invalid"
    )
    expect(fake.requests.at(-1)).toMatchObject({ method: "GET", path: "/addresses" })
  })

  it("creates, lists and removes a sender address", async () => {
    const created = await api.createSenderAddress(credentials(), SENDER)
    const listed = await api.senderAddresses(credentials())
    await api.deleteAddress(credentials(), created.id)

    expect(created).toMatchObject({ shortName: "qt-sloc_1", cityCode: "34" })
    expect(listed.map(({ id }) => id)).toEqual([created.id])
    expect(fake.addresses.size).toBe(0)
    expect(fake.requests[0]?.body).toMatchObject({ isRecipientAddress: false })
  })

  it("throws Geliver's refusal by its code, and a garbled answer as invalid", async () => {
    const refused = await codeOf(api.createSenderAddress(credentials(), { ...SENDER, zip: "" }))
    fake.queue("GET /addresses", { body: { result: true, data: [{ name: "no id" }] } })
    const garbled = await codeOf(api.senderAddresses(credentials()))
    fake.queue("GET /addresses", { body: { result: false, code: "LIMIT" } })
    const envelope = await codeOf(api.senderAddresses(credentials()))

    expect(refused).toBe("error_VALIDATION_ERROR")
    expect(garbled).toBe("invalid_response")
    expect(envelope).toBe("error_LIMIT")
  })

  it("tries a read again after a gateway error, never a create whose outcome is unknown", async () => {
    fake.queue("GET /addresses", { status: 502, body: {} })
    const read = await api.senderAddresses(credentials())
    fake.queue("POST /addresses", { status: 502, body: {} })
    const create = await codeOf(api.createSenderAddress(credentials(), SENDER))

    expect(read).toEqual([])
    expect(create).toBe("outcome_unknown")
    expect(fake.requests.filter(({ method }) => method === "POST")).toHaveLength(1)
  })
})

describe("Geliver account and codes", () => {
  it("reads the stored account: the token sealed, the test mode in the clear", () => {
    expect(
      geliverCredentialsOf({ settings: { test_mode: true }, secrets: { api_token: "t" } })
    ).toEqual({ token: "t", testMode: true })
    expect(geliverCredentialsOf({ settings: {}, secrets: {} })).toBeNull()
    expect(geliverCredentialsOf(null)).toBeNull()
  })

  it("keeps a usable code visible and drops anything else", () => {
    expect(geliverErrorCode("OFFER_EXPIRED")).toBe("error_OFFER_EXPIRED")
    expect(geliverErrorCode(1004)).toBe("error_1004")
    expect(geliverErrorCode("<script>")).toBe("rejected")
    expect(geliverErrorCode(undefined)).toBe("rejected")
  })
})
