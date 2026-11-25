import { platformServiceOf } from "../registry/platform-service"
import { aiServices } from "../registry/services"
import { IMAGE_SCENE_TASK } from "../registry/tasks"
import { canRunTask } from "../select"

/**
 * The #381 review: the platform's row in the panel's service list says
 * `scene` from the service behind it (`canRunTask`). That tells nothing
 * only while every registered image service can set a scene; one that
 * cannot would make `scene: false` name its provider. This holds the line:
 * adding such a service fails here, and the platform's row then needs a
 * value of its own.
 */
describe("the platform's scene", () => {
  const imageServices = aiServices("production").filter(
    (service) => service.capabilities.image_edit !== undefined
  )

  it("is something every registered image service can do", () => {
    expect(imageServices.length).toBeGreaterThan(1)
    for (const service of imageServices) {
      expect([service.id, canRunTask(service, IMAGE_SCENE_TASK)]).toEqual([service.id, true])
    }
  })

  it("is the same whichever image service runs behind the platform", () => {
    for (const service of imageServices) {
      const platform = platformServiceOf({ text: "deepseek", image_edit: service.id }, "production")
      expect(platform).not.toBeNull()
      expect([service.id, platform && canRunTask(platform, IMAGE_SCENE_TASK)]).toEqual([
        service.id,
        true,
      ])
    }
  })
})
