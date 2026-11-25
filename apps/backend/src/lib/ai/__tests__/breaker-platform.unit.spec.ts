import { aiBreakerKeyOf, resetAiBreakers, withAiBreaker } from "../breaker"
import { aiProviderError } from "../errors"

/**
 * The security review of P4b-1 (D2): on the platform's credits each
 * capability has its own breaker, since another provider runs each behind
 * the gateway; the shop's own services keep one breaker per service.
 */

const options = { failureThreshold: 2, resetAfterMs: 60_000 }
const unwell = () =>
  Promise.reject(
    aiProviderError({ service: "platform", key: "ai.provider_unavailable", code: "http_503" })
  )
const ok = () => Promise.resolve("ok")

beforeEach(() => {
  resetAiBreakers()
})

describe("the breaker a call runs through", () => {
  it("is one per capability on the platform, and the service's own otherwise", () => {
    expect(aiBreakerKeyOf({ service: "platform", capability: "text" })).toBe("platform:text")
    expect(aiBreakerKeyOf({ service: "platform", capability: "vision" })).toBe("platform:vision")
    expect(aiBreakerKeyOf({ service: "platform", capability: "image_edit" })).toBe(
      "platform:image_edit"
    )
    expect(aiBreakerKeyOf({ service: "deepseek", capability: "text" })).toBe("deepseek")
    expect(aiBreakerKeyOf({ service: "deepseek", capability: "vision" })).toBe("deepseek")
    expect(aiBreakerKeyOf("gemini")).toBe("gemini")
  })

  it("keeps the platform's text calls going while its image editing is unwell", async () => {
    const edit = { service: "platform", capability: "image_edit" } as const
    await expect(withAiBreaker(edit, unwell, options)).rejects.toBeDefined()
    await expect(withAiBreaker(edit, unwell, options)).rejects.toBeDefined()
    // The editing circuit is open: no call, the panel hears it at once, under the service's name
    const call = jest.fn(ok)
    await expect(withAiBreaker(edit, call, options)).rejects.toMatchObject({
      safeMessage: "ai.provider_unavailable",
      provider: "platform",
    })
    expect(call).not.toHaveBeenCalled()

    await expect(
      withAiBreaker({ service: "platform", capability: "text" }, ok, options)
    ).resolves.toBe("ok")
    await expect(
      withAiBreaker({ service: "platform", capability: "vision" }, ok, options)
    ).resolves.toBe("ok")
  })

  it("keeps one breaker for all of a shop's own service's capabilities", async () => {
    const down = () =>
      Promise.reject(
        aiProviderError({ service: "gemini", key: "ai.provider_unavailable", code: "http_503" })
      )
    await expect(
      withAiBreaker({ service: "gemini", capability: "image_edit" }, down, options)
    ).rejects.toBeDefined()
    await expect(withAiBreaker("gemini", down, options)).rejects.toBeDefined()
    const call = jest.fn(ok)
    await expect(
      withAiBreaker({ service: "gemini", capability: "text" }, call, options)
    ).rejects.toMatchObject({ safeMessage: "ai.provider_unavailable" })
    expect(call).not.toHaveBeenCalled()
  })
})
