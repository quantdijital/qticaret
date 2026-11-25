import { FAKE_SERVICE, aiServices } from "../registry/services"
import type { AiService } from "../registry/services"
import { findAiTask } from "../registry/tasks"
import { chooseService, requestedFundingOf, usableServices } from "../select"
import type { AiConnection } from "../select"

/**
 * A request never moves to another way of paying by itself (security
 * review of P4b-1, O1): the shop's own key to the platform's credits, or
 * back, only when the staff member picks it.
 */

const services = aiServices("test")
const PLATFORM: AiService = {
  ...FAKE_SERVICE,
  id: "platform",
  credentialProvider: "platform",
  funding: "platform_credit",
}
const task = findAiTask("seo_title", "test")
if (!task) {
  throw new Error("no seo_title task")
}
const connected = (...providers: string[]): AiConnection[] =>
  providers.map((provider) => ({ provider, status: "connected" }))
const usable = (providers: string[], flags = { ownKeys: true, platformCredits: true }) =>
  usableServices(task, connected(...providers), flags, [...services, PLATFORM])

describe("service selection keeps the way of paying asked for", () => {
  it("reads a requested service's way of paying", () => {
    expect(requestedFundingOf("platform")).toBe("platform_credit")
    expect(requestedFundingOf("deepseek")).toBe("own_key")
    expect(requestedFundingOf("nobody")).toBe("own_key")
  })

  it("does not move a request for the shop's own key to the platform left alone", () => {
    const only = usable([])
    expect(only.map((each) => each.id)).toEqual(["platform"])
    expect(chooseService({ task, usable: only, requested: "deepseek" })).toEqual({
      ok: false,
      error: "ai.service_unavailable",
      alternatives: ["platform"],
    })
  })

  it("does not move a request for the platform to the shop's own key left alone", () => {
    const only = usable(["deepseek"], { ownKeys: true, platformCredits: false })
    expect(only.map((each) => each.id)).toEqual(["deepseek"])
    expect(chooseService({ task, usable: only, requested: "platform" })).toEqual({
      ok: false,
      error: "ai.service_unavailable",
      alternatives: ["deepseek"],
    })
  })

  it("still takes the only one paid the same way as the one asked for", () => {
    const own = usable(["minimax"], { ownKeys: true, platformCredits: false })
    expect(chooseService({ task, usable: own, requested: "deepseek" })).toMatchObject({
      ok: true,
      service: { id: "minimax" },
    })
    expect(chooseService({ task, usable: usable([]), requested: "platform" })).toMatchObject({
      ok: true,
      service: { id: "platform" },
    })
  })

  it("takes the shop's own key first when nothing is asked, else the platform", () => {
    expect(chooseService({ task, usable: usable(["deepseek"]) })).toMatchObject({
      ok: true,
      service: { id: "deepseek" },
      alternatives: ["platform"],
    })
    expect(chooseService({ task, usable: usable([]) })).toMatchObject({
      ok: true,
      service: { id: "platform" },
    })
    expect(chooseService({ task, usable: usable([]), preference: "deepseek" })).toMatchObject({
      ok: true,
      service: { id: "platform" },
    })
  })
})
