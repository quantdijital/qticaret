import type { SubscriberArgs } from "@medusajs/framework"
import {
  dropUnneededShippingWorkflow,
  unneededShippingMethods,
} from "../../workflows/checkout/unneeded-shipping"
import cartUnneededShipping, { config } from "../cart-unneeded-shipping"

jest.mock("../../workflows/checkout/unneeded-shipping", () => ({
  unneededShippingMethods: jest.fn(),
  dropUnneededShippingWorkflow: jest.fn(),
}))

const unneeded = unneededShippingMethods as jest.MockedFunction<typeof unneededShippingMethods>
const workflow = dropUnneededShippingWorkflow as unknown as jest.Mock

const input = {
  event: { name: "cart.updated", data: { id: "cart_1" } },
  container: {},
} as unknown as SubscriberArgs<{ id: string }>

let run: jest.Mock

beforeEach(() => {
  jest.resetAllMocks()
  run = jest.fn().mockResolvedValue({ result: ["casm_1"] })
  workflow.mockReturnValue({ run })
})

describe("a changed cart's unneeded shipping method (adr/0076 Ek D5)", () => {
  it("listens to the cart's changes", () => {
    expect(config.event).toBe("cart.updated")
  })

  it("takes the method off under the cart's lock once nothing ships", async () => {
    unneeded.mockResolvedValue(["casm_1"])
    await cartUnneededShipping(input)
    expect(run).toHaveBeenCalledWith({ input: { cart_id: "cart_1" } })
  })

  it("takes no lock for a cart that keeps its method", async () => {
    unneeded.mockResolvedValue([])
    await cartUnneededShipping(input)
    expect(workflow).not.toHaveBeenCalled()
  })

  it("only logs a failure: the payment's start takes the method off too", async () => {
    unneeded.mockResolvedValue(["casm_1"])
    run.mockRejectedValue(new Error("lock"))
    await expect(cartUnneededShipping(input)).resolves.toBeUndefined()
  })
})
