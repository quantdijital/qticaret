import { aiTargetModels, aiTargetUncapped } from "@qticaret/types/control-plane"
import { checkedRoute, storedRouting } from "../routing"

/**
 * A stored routing read back (adr/0085 §2; a test the second security
 * review of P3b asked for): an entry routed before its output had no cap
 * (Gemini's chat: no documented field caps it, ai-targets.ts) is left out
 * as it is read, so a call is never sent to it on credits, while the
 * entries still valid are kept.
 */

const models = (service: string, capability: string): readonly string[] =>
  aiTargetModels(service, capability, process.env["NODE_ENV"]) ?? []

describe("a stored routing read back", () => {
  it("leaves out a Gemini text or vision route, keeps the rest", () => {
    const geminiText = models("gemini", "text")[0]
    const deepseek = models("deepseek", "text")[0]
    const geminiImage = models("gemini", "image_edit")[0]
    expect([geminiText, deepseek, geminiImage].every((model) => model !== undefined)).toBe(true)
    expect([aiTargetUncapped("gemini", "text"), aiTargetUncapped("gemini", "vision")]).toEqual([
      true,
      true,
    ])
    const stored = {
      text: { service: "gemini", model: geminiText },
      vision: { service: "gemini", model: geminiText },
      image_edit: { service: "gemini", model: geminiImage },
    }
    expect(storedRouting(stored)).toEqual({ image_edit: stored.image_edit })
    const mixed = { ...stored, text: { service: "deepseek", model: deepseek } }
    expect(storedRouting(mixed)).toEqual({
      text: mixed.text,
      image_edit: stored.image_edit,
    })
    // Never taken new either
    expect(() => checkedRoute("text", stored.text as { service: string; model: string })).toThrow(
      "cp.ai_route_uncapped"
    )
  })

  it("refuses and leaves out a Bria route until a real call proves its result's host", () => {
    const bria = models("bria", "image_edit")[0] ?? ""
    expect(bria).toBe("RMBG2")
    const route = { service: "bria", model: bria }
    expect(() => checkedRoute("image_edit", route)).toThrow("cp.ai_route_unverified")
    expect(storedRouting({ image_edit: route })).toEqual({})
    // Another image service still routes
    const photoroom = { service: "photoroom", model: models("photoroom", "image_edit")[0] ?? "" }
    expect(checkedRoute("image_edit", photoroom)).toEqual(photoroom)
  })

  it("reads nothing routable from what is not a routing", () => {
    for (const value of [null, "text", [], 3]) {
      expect(storedRouting(value)).toEqual({})
    }
    expect(
      storedRouting({ text: { service: "gemini" }, nope: { service: "x", model: "y" } })
    ).toEqual({})
  })
})
