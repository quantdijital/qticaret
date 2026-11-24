import { PUBLISHABLE_KEY_HEADER, varyOnPublishableKey } from "../vary"

describe("varyOnPublishableKey", () => {
  it("adds the publishable key through Express's merging vary, once per call", () => {
    const vary = jest.fn()
    varyOnPublishableKey({ vary })
    expect(vary).toHaveBeenCalledTimes(1)
    expect(vary).toHaveBeenCalledWith("x-publishable-api-key")
  })

  it("names the header Medusa reads the sales channels from", () => {
    expect(PUBLISHABLE_KEY_HEADER).toBe("x-publishable-api-key")
  })
})
