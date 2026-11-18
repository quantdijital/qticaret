import { AdminPostAiSuggestion } from "../validators"

/**
 * A scene asked for (Aşama 7): one picture and the scene's code, nothing
 * else; never a prompt. Whether the code is one of the shop's is the
 * workflow's to say (its packs), not this schema's.
 */

const SCENE = {
  task: "image_scene",
  entity_type: "media",
  entity_ids: ["media_01ABC"],
  option: "studio_table",
}

const ok = (body: unknown) => AdminPostAiSuggestion.safeParse(body).success

describe("POST /admin/ai/suggestions: a scene", () => {
  it("takes one picture and a scene code, with or without a service", () => {
    expect(ok(SCENE)).toBe(true)
    expect(ok({ ...SCENE, service: "photoroom" })).toBe(true)
  })

  it.each([
    ["two pictures", { ...SCENE, entity_ids: ["media_01ABC", "media_02ABC"] }],
    ["a prompt", { ...SCENE, prompt: "a wooden table" }],
    ["free text as the scene", { ...SCENE, option: "a wooden table in soft light" }],
    ["no scene", { ...SCENE, option: undefined }],
    ["a record that is no picture", { ...SCENE, entity_ids: ["prod_01ABC"] }],
  ])("refuses %s", (_what, body) => {
    expect(ok(body)).toBe(false)
  })

  it("keeps a background request to its two backgrounds", () => {
    const background = { ...SCENE, task: "image_background", option: "white" }
    expect(ok(background)).toBe(true)
    expect(ok({ ...background, option: "studio_table" })).toBe(false)
  })
})
