import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { provenCustomer } from "../../../../../../workflows/account/proven-customer"
import { askToConfirmConsent } from "../../../../../../workflows/messaging/consent-confirmation"
import { customerAddresses, customerConsents } from "../../../../../../workflows/messaging/consents"
import { GET, POST } from "../route"
import type { StorePostConsentType } from "../validators"

jest.mock("../../../../../../workflows/account/proven-customer", () => ({
  provenCustomer: jest.fn(),
}))
jest.mock("../../../../../../workflows/messaging/consent-confirmation", () => ({
  askToConfirmConsent: jest.fn(),
}))
jest.mock("../../../../../../workflows/messaging/consents", () => ({
  customerAddresses: jest.fn(),
  customerConsents: jest.fn(() => Promise.resolve({})),
  storefrontEvidence: jest.fn(() => ({})),
}))
jest.mock("../../../../../http/client-ip", () => ({ clientIp: () => "203.0.113.7" }))

const proven = provenCustomer as jest.MockedFunction<typeof provenCustomer>
const ask = askToConfirmConsent as jest.MockedFunction<typeof askToConfirmConsent>
const addresses = customerAddresses as jest.MockedFunction<typeof customerAddresses>
const consents = customerConsents as jest.MockedFunction<typeof customerConsents>
const recordConsent = jest.fn()
const consentRequestPending = jest.fn()
/** Whose the consent on record is, if any. */
let onRecord: string | null = null

const scope = {
  resolve: () => ({
    recordConsent,
    consentRequestPending,
    recipientOf: () => ({ hash: "hash", masked: "al***@example.com" }),
    listMessageConsents: () =>
      Promise.resolve(onRecord === null ? [] : [{ customer_id: onRecord }]),
  }),
}

function respond() {
  let status = 200
  const res = {
    status(code: number) {
      status = code
      return res
    },
    setHeader: jest.fn(),
    json: jest.fn(),
  }
  return { res, status: () => status }
}

async function post(body: Partial<StorePostConsentType>) {
  const req = {
    auth_context: { actor_type: "customer", actor_id: "cus_1" },
    validatedBody: { text_version: "v1", ...body },
    scope,
  } as unknown as AuthenticatedMedusaRequest<StorePostConsentType>
  const answer = respond()
  await POST(req, answer.res as unknown as MedusaResponse)
  return answer.status()
}

beforeEach(() => {
  jest.clearAllMocks()
  onRecord = null
  addresses.mockResolvedValue({ email: "ali@example.com", sms: "+905321234567" })
  ask.mockResolvedValue({ request_id: "creq_1" })
  consentRequestPending.mockResolvedValue(false)
})

/** Security review of PR #73: a session alone does not prove the account's address. */
describe("an account's e-mail consent", () => {
  it("is recorded at once for a customer who proved the address", async () => {
    proven.mockResolvedValue(true)

    expect(await post({ channel: "email", status: "granted" })).toBe(200)
    expect(proven).toHaveBeenCalledWith(expect.anything(), "cus_1")
    expect(recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "email", address: "ali@example.com", status: "granted" })
    )
    expect(ask).not.toHaveBeenCalled()
    expect(consents).toHaveBeenCalledWith(expect.anything(), "cus_1", { emailUnproven: false })
  })

  it("waits for the address to confirm it when the customer never proved it", async () => {
    proven.mockResolvedValue(false)

    expect(await post({ channel: "email", status: "granted" })).toBe(202)
    expect(recordConsent).not.toHaveBeenCalled()
    expect(ask).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        channel: "email",
        address: "ali@example.com",
        customer_id: "cus_1",
      })
    )
    // The address owner's answer is not shown to whoever holds the account
    expect(consents).toHaveBeenCalledWith(expect.anything(), "cus_1", { emailUnproven: true })
  })

  it("sends nothing more while the same confirmation is on its way", async () => {
    proven.mockResolvedValue(false)
    consentRequestPending.mockResolvedValue(true)

    expect(await post({ channel: "email", status: "granted" })).toBe(202)
    expect(consentRequestPending).toHaveBeenCalledWith(
      { channel: "email", address: "ali@example.com", status: "granted", customer_id: "cus_1" },
      expect.any(Date)
    )
    expect(ask).not.toHaveBeenCalled()
  })

  it("withdraws at once a consent on record as the customer's own, proven or not", async () => {
    proven.mockResolvedValue(false)
    onRecord = "cus_1"

    expect(await post({ channel: "email", status: "revoked" })).toBe(200)
    expect(recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "email", status: "revoked" })
    )
    expect(ask).not.toHaveBeenCalled()
  })

  it("asks the owner before withdrawing another's consent", async () => {
    proven.mockResolvedValue(false)
    onRecord = "cus_2"

    expect(await post({ channel: "email", status: "revoked" })).toBe(202)
    expect(recordConsent).not.toHaveBeenCalled()
    expect(ask).toHaveBeenCalled()
  })
})

describe("an account's phone consent", () => {
  it("waits for the number's owner even for a proven customer, and is not sent twice", async () => {
    proven.mockResolvedValue(true)

    expect(await post({ channel: "sms", status: "granted" })).toBe(202)
    consentRequestPending.mockResolvedValue(true)
    expect(await post({ channel: "sms", status: "granted" })).toBe(202)
    expect(recordConsent).not.toHaveBeenCalled()
    expect(ask).toHaveBeenCalledTimes(1)
  })
})

describe("reading the account's consents", () => {
  it("shows the e-mail's answer only to a customer who proved the address", async () => {
    for (const isProven of [true, false]) {
      proven.mockResolvedValue(isProven)
      const answer = respond()
      await GET(
        { auth_context: { actor_id: "cus_1" }, scope } as unknown as AuthenticatedMedusaRequest,
        answer.res as unknown as MedusaResponse
      )
      expect(consents).toHaveBeenLastCalledWith(expect.anything(), "cus_1", {
        emailUnproven: !isProven,
      })
    }
  })
})
