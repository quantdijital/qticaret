import { SECTIONS } from "../sections"
import { GUIDANCE_LIMITS, isGuidanceTask, plainGuidanceText } from "../sections/ai-guidance"
import { parseStored } from "../sections/stored"

const { full, patch, defaults } = SECTIONS.ai_guidance

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? []

const parse = (values: Record<string, unknown>) => full.safeParse({ ...defaults, ...values })

describe("ai_guidance section", () => {
  it("starts warm, addressing the reader as siz, with nothing typed", () => {
    expect(full.parse(defaults)).toEqual({
      tone: "warm",
      address: "siz",
      audience: null,
      guide: null,
      prefer: [],
      avoid: [],
      tasks: {},
    })
  })

  it("takes any subset of fields and refuses unknown ones and unknown choices", () => {
    expect(patch.safeParse({ tone: "premium" }).success).toBe(true)
    expect(patch.safeParse({ craft: "x" }).success).toBe(false)
    expect(patch.safeParse({ tone: "funny" }).success).toBe(false)
    expect(patch.safeParse({ address: "o" }).success).toBe(false)
  })

  it.each([
    ["audience", { audience: "a".repeat(GUIDANCE_LIMITS.audience + 1) }],
    ["guide", { guide: "a".repeat(GUIDANCE_LIMITS.guide + 1) }],
    ["a word", { prefer: ["a".repeat(GUIDANCE_LIMITS.word + 1)] }],
    ["a task's note", { tasks: { seo_title: { extra: "a".repeat(GUIDANCE_LIMITS.extra + 1) } } }],
    [
      "an example",
      { tasks: { seo_title: { examples: ["a".repeat(GUIDANCE_LIMITS.example + 1)] } } },
    ],
  ])("refuses %s over its limit", (_, values) => {
    expect(messages(parse(values))).toContain("ai.guidance_too_long")
  })

  it("keeps a text at its limit, counted in characters, not bytes", () => {
    const audience = "ğ".repeat(GUIDANCE_LIMITS.audience)
    expect(parse({ audience }).data?.audience).toBe(audience)
  })

  it("refuses a 21st word and a 4th example", () => {
    const words = Array.from({ length: 21 }, (_, i) => `sözcük ${String(i)}`)
    expect(messages(parse({ avoid: words }))).toContain("ai.guidance_words_full")
    const examples = ["bir", "iki", "üç", "dört"]
    expect(messages(parse({ tasks: { seo_title: { examples } } }))).toContain(
      "ai.guidance_examples_full"
    )
  })

  it("takes guidance for the registry's text tasks only", () => {
    expect(isGuidanceTask("seo_title")).toBe(true)
    expect(isGuidanceTask("review_reply")).toBe(true)
    expect(isGuidanceTask("image_background")).toBe(false)
    expect(isGuidanceTask("__proto__")).toBe(false)
    for (const id of ["made_up", "image_alt_text", "product_from_photo"]) {
      expect(messages(parse({ tasks: { [id]: { extra: "kısa yaz" } } }))).toContain(
        "ai.guidance_unknown_task"
      )
    }
    // A task's own craft is a field of its own (adr/0074 §3); anything else stays refused
    expect(parse({ tasks: { seo_title: { extra: "kısa", craft: "x" } } }).success).toBe(true)
    expect(parse({ tasks: { seo_title: { craft_base: "nope" } } }).success).toBe(false)
    expect(parse({ tasks: { seo_title: { prompt: "x" } } }).success).toBe(false)
  })

  it("takes markup, invisible and control characters out and folds spaces", () => {
    const result = parse({
      audience: "  ev <b>aşçıları</b>​\u0007 ve\tkamp severler ",
      guide: "Birinci satır\r\n\r\n\r\n\r\n<script>x</script>ikinci   satır",
    }).data
    expect(result?.audience).toBe("ev aşçıları ve kamp severler")
    // The tags go, their words stay as plain text; one empty line kept at most
    expect(result?.guide).toBe("Birinci satır\n\nx ikinci satır")
  })

  it("takes personal data out", () => {
    const result = parse({
      guide: "Sorular için 0532 123 45 67 ya da ali@ornek.com",
      tasks: { seo_description: { examples: ["IBAN TR33 0006 1005 1978 6457 8413 26 değil"] } },
    }).data
    expect(result?.guide).toBe("Sorular için […] ya da […]")
    expect(result?.tasks["seo_description"]?.examples).toEqual(["IBAN […] değil"])
  })

  it("drops empty words and the same word twice; keeps a cleared task empty", () => {
    const result = parse({
      prefer: ["El yapımı", " ", "el yapımı", "<i></i>", "dayanıklı"],
      tasks: { seo_title: { extra: "  ", examples: [""] }, product_title: { extra: "Kısa" } },
    }).data
    expect(result?.prefer).toEqual(["El yapımı", "dayanıklı"])
    expect(result?.tasks).toEqual({
      seo_title: { extra: null, examples: [] },
      product_title: { extra: "Kısa", examples: [] },
    })
    expect(parse({ audience: "   " }).data?.audience).toBeNull()
  })

  it("is idempotent: a stored value passes again unchanged", () => {
    const once = full.parse({
      ...defaults,
      guide: "Ara: 0532 123 45 67\n\n<b>kalın</b> yazma",
      prefer: ["el yapımı"],
      tasks: { seo_title: { examples: ["Örnek  bir"] } },
    })
    expect(full.parse(once)).toEqual(once)
  })

  it("reads a stored row with a task a deploy no longer knows, keeping the rest", () => {
    const read = parseStored("ai_guidance", {
      tone: "plain",
      tasks: { gone_task: { extra: "x", examples: [] }, seo_title: { extra: "y", examples: [] } },
    })
    expect(read["tone"]).toBe("plain")
    expect(read["tasks"]).toEqual({ seo_title: { extra: "y", examples: [] } })
  })

  it("plain text keeps a line break only where asked", () => {
    expect(plainGuidanceText("a\nb", false)).toBe("a b")
    expect(plainGuidanceText("a\nb", true)).toBe("a\nb")
  })
})
