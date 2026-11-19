import { validateAndTransformBody } from "@medusajs/framework/http"
import { SECTIONS } from "../../../../modules/platform-settings/sections"
import { AdminPostAiSuggestion } from "../validators"

/**
 * A scene asked for (Aşama 7): one picture and either the scene's code (a
 * saved scene's id) or a scene typed once, cleaned here. Whether the code
 * is one of the shop's is the workflow's to say, not this schema's.
 */

// What Medusa's body validation hands the error handler, and the body it passes on
async function validated(schema: Parameters<typeof validateAndTransformBody>[0], body: unknown) {
  let caught: unknown = null
  const req = { body } as { body: unknown; validatedBody?: unknown }
  await validateAndTransformBody(schema)(req as never, {} as never, (error?: unknown) => {
    caught = error ?? null
  })
  return {
    refusal: (caught as { message?: string } | null)?.message ?? null,
    body: req.validatedBody,
  }
}

const SCENE = {
  task: "image_scene",
  entity_type: "media",
  entity_ids: ["media_01ABC"],
  option: "studio_table",
}

// A scene typed once: the same ask without a code
const TYPED = { task: "image_scene", entity_type: "media", entity_ids: ["media_01ABC"] }

const ok = (body: unknown) => AdminPostAiSuggestion.safeParse(body).success

describe("POST /admin/ai/suggestions: a scene", () => {
  it("takes one picture and a scene code, with or without a service", () => {
    expect(ok(SCENE)).toBe(true)
    expect(ok({ ...SCENE, service: "photoroom" })).toBe(true)
  })

  it("takes a saved scene's id, or a typed scene in place of a code", () => {
    expect(ok({ ...SCENE, option: "own_abcdefgh12" })).toBe(true)
    expect(ok({ ...TYPED, prompt: "pembe battaniye üstünde" })).toBe(true)
  })

  it.each([
    ["two pictures", { ...SCENE, entity_ids: ["media_01ABC", "media_02ABC"] }],
    ["a code and a prompt together", { ...SCENE, prompt: "a wooden table" }],
    ["an empty prompt", { ...SCENE, option: undefined, prompt: "" }],
    ["a long prompt", { ...SCENE, option: undefined, prompt: "x".repeat(801) }],
    ["a price with a prompt", { ...SCENE, option: undefined, prompt: "masa", price: 1 }],
    [
      "a prompt for a background",
      { ...SCENE, task: "image_background", option: undefined, prompt: "masa" },
    ],
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

describe("a scene typed once, and the shop's saved scenes, as the route sees them", () => {
  it("passes a typed scene on cleaned, personal data taken out", async () => {
    const { refusal, body } = await validated(AdminPostAiSuggestion, {
      ...TYPED,
      prompt: "  pembe battaniye,\n ara 0532 123 45 67 ",
    })
    expect(refusal).toBeNull()
    expect(body).toMatchObject({ prompt: "pembe battaniye, ara …" })
  })

  it.each([
    ["a link", "see https://example.com"],
    ["markup", "<img src=x>"],
    ["a long text", "ş".repeat(201)],
  ])("refuses %s with its key", async (_what, prompt) => {
    expect((await validated(AdminPostAiSuggestion, { ...TYPED, prompt })).refusal).toBe(
      "Invalid request: ai.scene_text_invalid"
    )
  })

  it("refuses a thirteenth saved scene and a bad one with their keys", async () => {
    const scenes = Array.from({ length: 13 }, () => ({ prompt: "taş" }))
    const patch = SECTIONS.ai_scenes.patch
    expect((await validated(patch, { scenes })).refusal).toBe("Invalid request: ai.scenes_full")
    expect((await validated(patch, { scenes: [{ prompt: "<b>x</b>" }] })).refusal).toBe(
      "Invalid request: ai.scene_text_invalid"
    )
  })
})
