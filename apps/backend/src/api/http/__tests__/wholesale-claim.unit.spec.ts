import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { claimAccountWorkflow, claimableAccount } from "../../../workflows/wholesale/accounts/claim"
import { claimWholesaleAccount } from "../wholesale-claim"

jest.mock("../../../workflows/wholesale/accounts/claim", () => ({
  claimableAccount: jest.fn(),
  claimAccountWorkflow: jest.fn(),
}))

const claimable = claimableAccount as jest.MockedFunction<typeof claimableAccount>
const workflow = claimAccountWorkflow as unknown as jest.Mock
const run = jest.fn()

function request(method: string, auth: object | undefined, enabled = true) {
  return {
    method,
    auth_context: auth,
    scope: { resolve: () => ({ isFeatureEnabled: () => Promise.resolve(enabled) }) },
  } as unknown as MedusaRequest
}

const customer = { actor_type: "customer", actor_id: "cus_1" }

async function pass(req: MedusaRequest) {
  const next = jest.fn()
  await claimWholesaleAccount(req, {} as MedusaResponse, next)
  expect(next).toHaveBeenCalledWith()
}

beforeEach(() => {
  jest.clearAllMocks()
  workflow.mockReturnValue({ run })
  run.mockResolvedValue({ result: { account_id: "wacc_1" } })
})

/** ADR-0068 §3: an invited wholesaler's account taken on reading their own account. */
describe("the claim on GET /store/customers/me", () => {
  it("takes the pending account for the signed-in customer only, the id from the session", async () => {
    claimable.mockResolvedValue("wacc_1")
    await pass(request("GET", customer))
    expect(claimable).toHaveBeenCalledWith(expect.anything(), "cus_1")
    expect(run).toHaveBeenCalledWith({ input: { customer_id: "cus_1" } })
  })

  it("runs no workflow when there is nothing to take", async () => {
    claimable.mockResolvedValue(null)
    await pass(request("GET", customer))
    expect(run).not.toHaveBeenCalled()
  })

  it("does nothing on a write, for a guest or a staff member, or with the flag off", async () => {
    claimable.mockResolvedValue("wacc_1")
    await pass(request("POST", customer))
    await pass(request("GET", undefined))
    await pass(request("GET", { actor_type: "user", actor_id: "user_1" }))
    await pass(request("GET", customer, false))
    expect(claimable).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it("leaves the customer reading their account when the claim fails", async () => {
    claimable.mockResolvedValue("wacc_1")
    run.mockRejectedValue(new Error("lock timeout"))
    await pass(request("GET", customer))
  })
})
