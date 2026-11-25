import { aiTargetUnverified } from "@qticaret/types/control-plane"
import {
  PLATFORM_BACKGROUNDS,
  platformBackgroundsOf,
  platformServiceOf,
} from "../registry/platform-service"
import { aiServices } from "../registry/services"

/**
 * The security review of P4b-2 (D1): the platform's row in the panel's
 * service list offers its own backgrounds, never the list of the service
 * behind it, which would tell which provider that is. The list is one
 * every registered image service makes, so the backing can always make it.
 */
describe("the platform's backgrounds", () => {
  it("are made by every registered image service that can run behind it", () => {
    const imageServices = aiServices("production").filter(
      (service) => service.capabilities.image_edit !== undefined
    )
    expect(imageServices.length).toBeGreaterThan(1)
    for (const service of imageServices) {
      const target = service.capabilities.image_edit
      const made = target && "backgrounds" in target ? target.backgrounds : []
      for (const background of PLATFORM_BACKGROUNDS) {
        expect(made).toContain(background)
      }
    }
  })

  // Bria joins once a real call proves its result's host (ai-targets.ts `unverified`)
  it.each(["photoroom", "gemini", "bria"].filter((id) => !aiTargetUnverified(id, "image_edit")))(
    "are the same whichever service %s runs behind",
    (id) => {
      const platform = platformServiceOf({ text: "deepseek", image_edit: id }, "production")
      expect(platform).not.toBeNull()
      expect(platform && platformBackgroundsOf(platform)).toEqual(["white"])
    }
  )

  it("are none while the image service named is not yet proven (Bria)", () => {
    expect(aiTargetUnverified("bria", "image_edit")).toBe(true)
    const platform = platformServiceOf({ text: "deepseek", image_edit: "bria" }, "production")
    expect(platform && platformBackgroundsOf(platform)).toEqual([])
  })

  it("are none where the platform edits no images", () => {
    const platform = platformServiceOf({ text: "deepseek" }, "production")
    expect(platform && platformBackgroundsOf(platform)).toEqual([])
  })
})
