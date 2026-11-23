import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { plainSearchForUnknownAddress } from "../search-routes"

/**
 * adr/0077 §7, security review D-2: a sentence whose shopper's address the
 * storefront could not read is searched as it is, never sent to the
 * service nor counted under the storefront's shared address.
 */

const mockAddress = { unknown: false }
jest.mock("../client-ip", () => ({
  ...jest.requireActual<object>("../client-ip"),
  isShopperAddressUnknown: () => mockAddress.unknown,
}))

function call(body: unknown) {
  const json = jest.fn()
  const next = jest.fn()
  plainSearchForUnknownAddress(
    { body } as unknown as MedusaRequest,
    { json } as unknown as MedusaResponse,
    next
  )
  return { json, next }
}

describe("plainSearchForUnknownAddress", () => {
  it("lets a shopper with a known address through to the limits", () => {
    mockAddress.unknown = false
    const { json, next } = call({ text: "Kapadokya balon" })
    expect(next).toHaveBeenCalled()
    expect(json).not.toHaveBeenCalled()
  })

  it("searches the sentence as it is when the address is unknown", () => {
    mockAddress.unknown = true
    const { json, next } = call({ text: " Kapadokya   balon " })
    expect(next).not.toHaveBeenCalled()
    expect(json).toHaveBeenCalledWith({
      query: "q=Kapadokya+balon",
      understood: [],
      dropped: [],
      fallback: true,
    })
  })

  it("leaves a body that is no sentence to the validator", () => {
    mockAddress.unknown = true
    expect(call({ text: "" }).next).toHaveBeenCalled()
    expect(call({ other: 1 }).next).toHaveBeenCalled()
  })
})
