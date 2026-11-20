import {
  AI_GUIDANCE_DEFAULTS,
  type AiGuidanceSettings,
} from "../../../modules/platform-settings/sections/ai-guidance"
import {
  GUIDANCE_END,
  GUIDANCE_HEADING,
  guidanceFor,
  guidanceText,
  readGuidance,
} from "../guidance"

const settings = (values: Partial<AiGuidanceSettings> = {}): AiGuidanceSettings => ({
  ...AI_GUIDANCE_DEFAULTS,
  ...values,
})

describe("guidanceText", () => {
  it("is null when the shop set nothing", () => {
    expect(guidanceText(settings(), "seo_title")).toBeNull()
  })

  it("is null for a task when only another task has guidance", () => {
    const only = settings({
      tasks: {
        product_title: { extra: "Kısa tut", examples: [] },
        // A cleared task is kept empty and says nothing
        seo_title: { extra: null, examples: [] },
      },
    })
    expect(guidanceText(only, "seo_title")).toBeNull()
    expect(guidanceText(only, "product_title")).toContain("Kısa tut")
  })

  it("says the tone and the address in the server's own words", () => {
    const text = guidanceText(settings({ tone: "premium", address: "sen" }), "seo_title") ?? ""
    expect(text.startsWith(GUIDANCE_HEADING)).toBe(true)
    expect(text).toContain("- Ton: Seçkin ve zarif yaz")
    expect(text).toContain("“sen”")
    expect(guidanceText(settings({ address: "none" }), "seo_title")).toContain(
      "Okura doğrudan hitap etme"
    )
  })

  it("lists every part the shop set, in order, its own lines indented", () => {
    const text =
      guidanceText(
        settings({
          audience: "ev aşçıları",
          guide: "El yapımıdır.\nTerimleri açıkla.",
          prefer: ["el yapımı", "dayanıklı"],
          avoid: ["ucuz"],
          tasks: {
            seo_description: { extra: "Faydayı öne al", examples: ["Birinci örnek", "İkinci"] },
          },
        }),
        "seo_description"
      ) ?? ""
    const order = [
      "- Ton:",
      "- Hitap:",
      "- Hedef kitle: ev aşçıları",
      "- Mağazanın notu:\n  El yapımıdır.\n  Terimleri açıkla.",
      "tercih edilecek sözcükler: “el yapımı”, “dayanıklı”",
      "Hiç kullanılmayacak sözcükler: “ucuz”",
      "- Bu iş için ek yönerge:\n  Faydayı öne al",
      "- Örnek 1 (ton ve yapı örneği; içeriğini kopyalama):\n  Birinci örnek",
      "- Örnek 2 (ton ve yapı örneği; içeriğini kopyalama):\n  İkinci",
      GUIDANCE_END,
    ].map((part) => text.indexOf(part))
    expect(text.endsWith(GUIDANCE_END)).toBe(true)
    expect(order.every((at) => at >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it("leaves out what is empty", () => {
    const text = guidanceText(settings({ tone: "plain" }), "seo_title") ?? ""
    expect(text).not.toContain("Hedef kitle")
    expect(text).not.toContain("Örnek")
    expect(text).not.toContain("sözcükler:")
  })
})

describe("readGuidance", () => {
  it("reads the section from the settings cache", async () => {
    const stored = settings({ audience: "kampçılar" })
    const getSection = jest.fn().mockResolvedValue(stored)
    const container = { resolve: () => ({ getSection }) } as never
    await expect(readGuidance(container)).resolves.toBe(stored)
    await expect(guidanceFor(container, "seo_title")).resolves.toContain("kampçılar")
    expect(getSection).toHaveBeenCalledWith("ai_guidance")
  })
})
