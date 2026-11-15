import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { provenCustomer } from "../../../../../../workflows/account/proven-customer"
import { askToConfirmConsent } from "../../../../../../workflows/messaging/consent-confirmation"
import { customerAddresses } from "../../../../../../workflows/messaging/consents"
import { POST } from "../route"
import type { StorePostConsentType } from "../validators"

jest.mock("../../../../../../workflows/account/proven-customer", () => ({
  provenCustomer: jest.fn(),
}))
jest.mock("../../../../../../workflows/messaging/consent-confirmation", () => ({
  askToConfirmConsent: jest.fn(),
}))
jest.mock("../../../../../../workflows/messaging/consents", () => ({
  customerAddresses: jest.fn(),
  customerConsents: jest.fn(() => Promise.resolve([])),
  storefrontEvidence: jest.fn(() => ({})),
}))
jest.mock("../../../../../http/client-ip", () => ({ clientIp: () => "203.0.113.7" }))

const proven = provenCustomer as jest.MockedFunction<typeof provenCustomer>
const ask = askToConfirmConsent as jest.MockedFunction<typeof askToConfirmConsent>
const addresses = customerAddresses as jest.MockedFunction<typeof customerAddresses>
const recordConsent = jest.fn()

async function post(body: Partial<StorePostConsentType>) {
  const req = {
    auth_context: { actor_type: "customer", actor_id: "cus_1" },
    validatedBody: { text_version: "v1", ...body },
    scope: {
      resolve: () => ({
        recordConsent,
        recipientOf: () => null,
        listMessageConsents: () => Promise.resolve([]),
      }),
    },
  } as unknown as AuthenticatedMedusaRequest<StorePostConsentType>
  let status = 200
  const res = {
    status(code: number) {
      status = code
      return res
    },
    json: jest.fn(),
  }
  await POST(req, res as unknown as MedusaResponse)
  return status
}

beforeEach(() => {
  jest.clearAllMocks()
  addresses.mockResolvedValue({ email: "ali@example.com", sms: null })
  ask.mockResolvedValue({ request_id: "creq_1" })
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
  })
})
