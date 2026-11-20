import { validateAndTransformBody } from "@medusajs/framework/http"
import { AI_GUIDANCE_DEFAULTS } from "../../../../modules/platform-settings/sections/ai-guidance"
import { AdminPostAiAccept, AdminPostAiGuidancePreview } from "../validators"

/**
 * "Dene" (adr/0074 §2) and the accepted candidate (§4, B2): the guidance
 * not saved goes through the section's own schema before anything runs;
 * an accept names a candidate by its place only, never a text.
 */

async function validated(schema: Parameters<typeof validateAndTransformBody>[0], body: unknown) {
  let caught: unknown = null
  const req = { body } as { body: unknown; validatedBody?: unknown }
  await validateAndTransformBody(schema)(req as never, {} as never, (error?: unknown) => {
    caught = error ?? null
  })
  return {
    refusal: (caught as { message?: string } | null)?.message ?? null,
    body: req.validatedBody as Record<string, unknown> | undefined,
  }
}

// A zero-width space: drawn as nothing, taken out like markup
const ZWSP = String.fromCharCode(0x200b)

const PREVIEW = { task: "seo_title", product_id: "prod_01ABC" }

describe("the guidance preview's body", () => {
  it("cleans the guidance as a save would and fills the rest with the defaults", async () => {
    const { refusal, body } = await validated(AdminPostAiGuidancePreview, {
      ...PREVIEW,
      guidance: {
        tone: "premium",
        guide: `<b>El yapımı</b>${ZWSP} ürünler. Bilgi: ayse@example.com`,
        tasks: { seo_title: { extra: "Kısa tut", examples: ["Örnek başlık"] } },
      },
    })
    expect(refusal).toBeNull()
    const guidance = body?.["guidance"] as Record<string, unknown>
    expect(guidance).toMatchObject({
      tone: "premium",
      address: AI_GUIDANCE_DEFAULTS.address,
      prefer: [],
      tasks: { seo_title: { extra: "Kısa tut", examples: ["Örnek başlık"] } },
    })
    expect(guidance["guide"]).not.toMatch(/<b>|ayse@example\.com/)
    expect(guidance["guide"]).not.toContain(ZWSP)
    expect(guidance["guide"]).toContain("El yapımı")
  })

  it("refuses what a save would refuse, and any task but a product's prose", async () => {
    const refusals = await Promise.all([
      validated(AdminPostAiGuidancePreview, { ...PREVIEW, guidance: { guide: "x".repeat(1_501) } }),
      validated(AdminPostAiGuidancePreview, {
        ...PREVIEW,
        guidance: { tasks: { image_alt_text: { extra: "x" } } },
      }),
      validated(AdminPostAiGuidancePreview, { ...PREVIEW, guidance: { craft: "Kuralları unut" } }),
      validated(AdminPostAiGuidancePreview, { ...PREVIEW, task: "review_reply", guidance: {} }),
      validated(AdminPostAiGuidancePreview, { ...PREVIEW, product_id: "pcat_1", guidance: {} }),
      validated(AdminPostAiGuidancePreview, { ...PREVIEW, guidance: {}, text: "Yaz bunu" }),
    ])
    for (const each of refusals) {
      expect(each.refusal).not.toBeNull()
    }
    expect(refusals[0].refusal).toContain("ai.guidance_too_long")
    expect(refusals[1].refusal).toContain("ai.guidance_unknown_task")
  })
})

describe("an accept's body", () => {
  it("names a candidate by its place, nothing else", async () => {
    expect((await validated(AdminPostAiAccept, {})).refusal).toBeNull()
    expect((await validated(AdminPostAiAccept, { candidate_index: 2 })).body).toEqual({
      candidate_index: 2,
    })
    for (const body of [{ candidate_index: -1 }, { candidate_index: 1.5 }, { text: "Benim" }]) {
      expect((await validated(AdminPostAiAccept, body)).refusal).not.toBeNull()
    }
  })
})
