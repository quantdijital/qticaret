import { estimateCost } from "../cost"
import { FAKE_SERVICE, findAiService, sceneTargetOf } from "../registry/services"
import type { AiService } from "../registry/services"

/** Cost estimates (adr/0071 §5): by the token, or by the image a service gives back. */

const service = (id: string): AiService => {
  const found = findAiService(id)
  if (!found) {
    throw new Error(`no ${id}`)
  }
  return found
}

describe("cost estimate", () => {
  it("prices a Photoroom edit at $0.02 an image given back", () => {
    const photoroom = service("photoroom")
    expect(estimateCost(photoroom, "image_edit", { images: 1 })).toEqual({
      micros: 20_000,
      currency: "USD",
    })
    expect(estimateCost(photoroom, "image_edit", { images: 3 })?.micros).toBe(60_000)
  })

  it("prices a Photoroom scene at its own $0.10, a Gemini scene by its tokens", () => {
    const photoroom = service("photoroom")
    const scene = sceneTargetOf(photoroom.capabilities.image_edit)
    const price = scene && "unitPrice" in scene ? scene.unitPrice : undefined
    expect(estimateCost(photoroom, "image_edit", { images: 1 }, price)?.micros).toBe(100_000)
    const gemini = service("gemini")
    const geminiScene = sceneTargetOf(gemini.capabilities.image_edit)
    expect(geminiScene && "unitPrice" in geminiScene).toBe(false)
    expect(
      estimateCost(gemini, "image_edit", { inputTokens: 1_000_000, outputTokens: 0 })?.micros
    ).toBe(1_500_000)
  })

  it("gives no estimate for an edit that gave nothing back", () => {
    const photoroom = service("photoroom")
    expect(estimateCost(photoroom, "image_edit", {})).toBeNull()
    expect(estimateCost(photoroom, "image_edit", { images: 0 })).toBeNull()
    // Tokens do not price a service billed by the image
    expect(estimateCost(photoroom, "image_edit", { inputTokens: 1_000 })).toBeNull()
    for (const images of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER]) {
      expect(estimateCost(photoroom, "image_edit", { images })).toBeNull()
    }
  })

  it("prices a Gemini edit by its tokens, as its pricing page does", () => {
    const gemini = service("gemini")
    expect(
      estimateCost(gemini, "image_edit", { inputTokens: 1_000_000, outputTokens: 1_000_000 })
    ).toEqual({ micros: 31_500_000, currency: "USD" })
    // An image count alone says nothing of a token price
    expect(estimateCost(gemini, "image_edit", { images: 1 })).toBeNull()
  })

  it("gives no estimate where the registry has no price", () => {
    expect(estimateCost(FAKE_SERVICE, "image_edit", { images: 1 })).toBeNull()
    expect(estimateCost(service("photoroom"), "text", { inputTokens: 10 })).toBeNull()
  })
})
