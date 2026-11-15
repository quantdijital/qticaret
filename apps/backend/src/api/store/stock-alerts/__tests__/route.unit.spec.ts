import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BACK_IN_STOCK_MODULE } from "../../../../modules/back-in-stock"
import { provenCustomer } from "../../../../workflows/account/proven-customer"
import { sendMessageWorkflow } from "../../../../workflows/messaging/send-message"
import { POST } from "../route"
import type { StorePostStockAlertType } from "../validators"

jest.mock("@medusajs/framework/utils", () => ({
  ...jest.requireActual<Record<string, unknown>>("@medusajs/framework/utils"),
  getVariantAvailability: jest.fn(() => Promise.resolve({ variant_1: { availability: 0 } })),
}))
jest.mock("../../../../workflows/account/proven-customer", () => ({ provenCustomer: jest.fn() }))
jest.mock("../../../../workflows/messaging/send-message", () => ({
  sendMessageWorkflow: jest.fn(),
}))

const proven = provenCustomer as jest.MockedFunction<typeof provenCustomer>
const send = sendMessageWorkflow as unknown as jest.Mock
const subscribe = jest.fn()

interface Graph {
  entity: string
}

const graph = (input: Graph) =>
  Promise.resolve({
    data:
      input.entity === "product_variant"
        ? [
            {
              id: "variant_1",
              product_id: "prod_1",
              manage_inventory: true,
              product: { status: "published" },
            },
          ]
        : [{ email: "ali@example.com" }],
  })

async function post(auth: object | undefined, email?: string) {
  const req = {
    auth_context: auth,
    validatedBody: { variant_id: "variant_1", ...(email ? { email } : {}) },
    publishable_key_context: { sales_channel_ids: ["sc_1"] },
    scope: {
      resolve: (key: string) =>
        key === ContainerRegistrationKeys.QUERY
          ? { graph }
          : key === BACK_IN_STOCK_MODULE
            ? { subscribe }
            : null,
    },
  } as unknown as AuthenticatedMedusaRequest<StorePostStockAlertType>
  const json = jest.fn<unknown, [{ status: string }]>()
  const res = { status: () => ({ json }) }
  await POST(req, res as unknown as MedusaResponse)
  return json.mock.calls[0]?.[0]
}

const customer = { actor_type: "customer", actor_id: "cus_1" }

beforeEach(() => {
  jest.clearAllMocks()
  send.mockReturnValue({ run: () => Promise.resolve() })
})

/** Security review of PR #73: a session alone does not prove the account's address. */
describe("a signed-in customer's stock alert", () => {
  it("is on at once for a customer who proved their address", async () => {
    proven.mockResolvedValue(true)
    subscribe.mockResolvedValue({ id: "alert_1", status: "active", token: null })

    expect(await post(customer)).toEqual({ status: "active" })
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ali@example.com", customer_id: "cus_1", confirmed: true })
    )
    expect(send).not.toHaveBeenCalled()
  })

  it("waits for the address to confirm it when the customer never proved it", async () => {
    proven.mockResolvedValue(false)
    subscribe.mockResolvedValue({ id: "alert_1", status: "pending", token: "t0ken" })

    expect(await post(customer)).toEqual({ status: "pending" })
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ali@example.com", customer_id: "cus_1", confirmed: false })
    )
    expect(send).toHaveBeenCalled()
  })

  it("asks a guest for no proof: the address confirms it", async () => {
    subscribe.mockResolvedValue({ id: "alert_1", status: "pending", token: "t0ken" })

    expect(await post(undefined, "misafir@example.com")).toEqual({ status: "pending" })
    expect(proven).not.toHaveBeenCalled()
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ email: "misafir@example.com", customer_id: null, confirmed: false })
    )
  })
})
