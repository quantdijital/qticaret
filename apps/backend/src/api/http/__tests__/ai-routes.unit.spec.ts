import type { MedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../../lib/security/rate-limit"
import { aiSuggestionProfile } from "../ai-routes"

const ask = (body: unknown) => ({ body }) as unknown as MedusaRequest

describe("aiSuggestionProfile", () => {
  it("counts a text task against the text budget", () => {
    expect(aiSuggestionProfile(ask({ task: "seo_title" }))).toBe(RATE_LIMIT_PROFILES.ai_text)
    for (const task of [
      "focus_keyword",
      "product_title",
      "short_description",
      "product_tags",
      "product_category",
    ]) {
      expect(aiSuggestionProfile(ask({ task }))).toBe(RATE_LIMIT_PROFILES.ai_text)
    }
    expect(aiSuggestionProfile(ask({ task: "product_description" }))).toBe(
      RATE_LIMIT_PROFILES.ai_text
    )
  })

  it("counts an image task against the narrower media budget", () => {
    expect(aiSuggestionProfile(ask({ task: "image_alt_text" }))).toBe(RATE_LIMIT_PROFILES.ai_media)
    // An image edit job (Aşama 4): its capability is image_edit
    expect(
      aiSuggestionProfile(ask({ task: "image_background", entity_type: "media", option: "white" }))
    ).toBe(RATE_LIMIT_PROFILES.ai_media)
    // A product's attributes may send its picture (adr/0074 §5 madde 3): counted as if it does
    expect(aiSuggestionProfile(ask({ task: "product_attributes" }))).toBe(
      RATE_LIMIT_PROFILES.ai_media
    )
  })

  it("counts an unknown, missing or malformed task as text", () => {
    for (const body of [{ task: "nope" }, {}, { task: 3 }, null, undefined, "image_alt_text"]) {
      expect(aiSuggestionProfile(ask(body))).toBe(RATE_LIMIT_PROFILES.ai_text)
    }
  })
})
