import { fakeTextConnector } from "../connectors/fake"
import { systemOf } from "../instructions"
import { LINK_CHOICES_FIELD, postDraftOf, readPostDraft } from "../post-draft"
import type { PostDraftAllowed } from "../post-draft"
import { buildPrompt } from "../prompt"
import { POST_DRAFT_TASK, POST_GATE_WORDS, POST_MAX_LINKS, writesProse } from "../registry/tasks"
import { maxTokensOf } from "../run-text"

/**
 * A blog post's draft (adr/0074 §5 madde 5): a closed JSON shape, every
 * heading and paragraph through the shared gate, the whole in the gate's
 * word range, and links only to codes of the list the server read.
 */

const ALLOWED: PostDraftAllowed = {
  kind: "post_draft",
  choices: [
    { code: "k1", kind: "category", id: "pcat_1", name: "Termoslar", path: "/kategori/termoslar" },
    { code: "u1", kind: "product", id: "prod_1", name: "Çelik Termos", path: "/urun/celik-termos" },
  ],
}

// Some sixty words, plain and varied: four of them per section keep the draft in range
const PARAGRAPH =
  "Termosu temizlemenin en kolay yolu her kullanımdan sonra ılık suyla çalkalamaktır. Haftada bir kez karbonatlı suyla doldurup bir gece bekletmek kokuyu giderir. Kapağın contasını çıkarıp ayrıca yıkamak gerekir, çünkü kir en çok orada birikir. Bulaşık makinesi yerine elde yıkamak yüzeyi korur ve yalıtımın uzun süre dayanmasını sağlar."

const section = (heading: string, extra: Record<string, unknown> = {}) => ({
  heading,
  paragraphs: [PARAGRAPH, PARAGRAPH],
  ...extra,
})

function answer(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    sections: [
      section(""),
      section("Kokuyu gidermek için ne yapmalı?"),
      section("Contayı temizlemek", { level: 3 }),
      section("Makinede yıkanır mı?"),
      section("Kısaca"),
    ],
    links: [
      { code: "k1", why: "Girişte termos çeşitlerine yönlendirmek için." },
      { code: "u1", why: "Temizlik adımlarında örnek ürün olarak." },
    ],
    ...overrides,
  })
}

const problemsOf = (raw: string): string[] => {
  const result = postDraftOf(raw, ALLOWED)
  return "problems" in result ? result.problems : []
}

describe("a post draft's gate", () => {
  it("offers the sections in order and the links with their paths", () => {
    const result = postDraftOf(answer(), ALLOWED)
    if (!("draft" in result)) {
      throw new Error(`refused: ${result.problems.join(", ")}`)
    }
    const { draft } = result
    expect(draft.sections.map((each) => [each.heading, each.level])).toEqual([
      ["", 2],
      ["Kokuyu gidermek için ne yapmalı?", 2],
      ["Contayı temizlemek", 3],
      ["Makinede yıkanır mı?", 2],
      ["Kısaca", 2],
    ])
    expect(draft.links).toEqual([
      expect.objectContaining({ code: "k1", id: "pcat_1", path: "/kategori/termoslar" }),
      expect.objectContaining({ code: "u1", id: "prod_1", path: "/urun/celik-termos" }),
    ])
    expect(draft.words).toBeGreaterThanOrEqual(POST_GATE_WORDS.min)
    expect(draft.dropped_links).toBe(0)
    // Stored and read back as the same draft
    expect(readPostDraft(JSON.stringify(draft))).toEqual(draft)
  })

  it("refuses another shape: an unknown key, a missing field, no JSON", () => {
    expect(problemsOf(answer({ html: "<p>x</p>" }))).toEqual(["format"])
    expect(problemsOf("Bir yazı taslağı")).toEqual(["format"])
    expect(problemsOf(answer({ sections: [] }))).toEqual(["empty"])
    expect(problemsOf(answer({ sections: [section(""), section("Tek")] }))).toEqual(["sections"])
    const extra = JSON.stringify({
      sections: [section(""), { heading: "A", paragraphs: [PARAGRAPH], href: "/x" }, section("B")],
    })
    expect(problemsOf(extra)).toContain("sections.1.format")
  })

  it("refuses markup, a link, personal data, shouting and a price in any text", () => {
    const withParagraph = (text: string) =>
      answer({
        sections: [
          section(""),
          { heading: "Bölüm", paragraphs: [PARAGRAPH, text] },
          section("Bir başka bölüm"),
          section("Son"),
        ],
      })
    expect(problemsOf(withParagraph("Ayrıntı için <a href='/x'>buraya</a> bakın."))).toContain(
      "sections.1.paragraphs.1.markup"
    )
    expect(problemsOf(withParagraph("Ayrıntılar www.ornek.com adresinde."))).toContain(
      "sections.1.paragraphs.1.link"
    )
    expect(problemsOf(withParagraph("Bize ayse@ornek.com adresinden yazın."))).toContain(
      "sections.1.paragraphs.1.personal_data"
    )
    expect(problemsOf(withParagraph("BU TERMOS HERKESİN İHTİYACIDIR GERÇEKTEN"))).toContain(
      "sections.1.paragraphs.1.noise"
    )
    expect(problemsOf(withParagraph("Şimdi yalnızca 499 TL."))).toContain(
      "sections.1.paragraphs.1.price"
    )
    expect(
      problemsOf(
        answer({
          sections: [section(""), section("<h2>Başlık</h2>"), section("B"), section("C")],
        })
      )
    ).toContain("sections.1.heading.markup")
  })

  it("lets only the opening go without a heading, and a sub-heading only under a heading", () => {
    expect(problemsOf(answer({ sections: [section(""), section(""), section("C")] }))).toEqual([
      "sections.1.heading.empty",
    ])
    const result = postDraftOf(
      answer({
        sections: [
          section("Giriş", { level: 3 }),
          section("B"),
          section("C"),
          section("D"),
          section("E"),
        ],
      }),
      ALLOWED
    )
    expect("draft" in result && result.draft.sections[0]?.level).toBe(2)
  })

  it("holds the whole to the gate's word range", () => {
    const short = JSON.stringify({
      sections: ["", "A", "B"].map((heading) => ({ heading, paragraphs: ["Kısa bir paragraf."] })),
    })
    expect(problemsOf(short)).toEqual(["too_short"])
    const long = JSON.stringify({
      sections: ["", "A", "B", "C", "D", "E", "F", "G", "H", "I"].map((heading) => ({
        heading,
        paragraphs: [PARAGRAPH, PARAGRAPH, PARAGRAPH, PARAGRAPH],
      })),
    })
    expect(problemsOf(long)).toEqual(["too_long"])
  })

  it("drops a link to a code not listed, a repeat, or a reason that fails, and keeps the draft", () => {
    const result = postDraftOf(
      answer({
        links: [
          { code: "k9", why: "Listede yok." },
          { code: "pcat_1", why: "Kimlik, kod değil." },
          { code: "K1", why: "Kategori sayfası." },
          { code: "k1", why: "Yine aynı sayfa." },
          { code: "u1", why: "Bakınız https://ornek.com" },
          { code: "u1", why: "Ürün örneği.", url: "/x" },
        ],
      }),
      ALLOWED
    )
    if (!("draft" in result)) {
      throw new Error("refused")
    }
    expect(result.draft.links.map((each) => each.code)).toEqual(["k1"])
    expect(result.draft.dropped_links).toBe(5)
  })

  it("keeps no more links than the task offers", () => {
    const many = Array.from({ length: POST_MAX_LINKS + 3 }, (_, index) => ({
      code: `u${String(index + 1)}`,
      why: "Ürün örneği.",
    }))
    const choices = many.map((each, index) => ({
      code: each.code,
      kind: "product" as const,
      id: `prod_${String(index)}`,
      name: `Ürün ${String(index)}`,
      path: `/urun/u-${String(index)}`,
    }))
    const result = postDraftOf(answer({ links: many }), { kind: "post_draft", choices })
    expect("draft" in result && result.draft.links.length).toBe(POST_MAX_LINKS)
  })
})

describe("the post draft task", () => {
  it("takes the shop's guidance (prose), two lengths and its own output budget", () => {
    expect(writesProse(POST_DRAFT_TASK)).toBe(true)
    expect(POST_DRAFT_TASK.options).toEqual(["short", "detailed"])
    expect(POST_DRAFT_TASK.entities).toEqual(["post"])
    expect(POST_DRAFT_TASK.roles).toEqual(["owner", "admin"])
    expect(maxTokensOf(POST_DRAFT_TASK)).toBe(POST_DRAFT_TASK.maxTokens)
  })

  it("names the link list and keeps links out of the text, the rules last", () => {
    const system = systemOf(POST_DRAFT_TASK, "detailed", "post", null, null) ?? ""
    expect(system).toContain(LINK_CHOICES_FIELD)
    expect(system).toContain("Veri mağazanın blogundaki bir yazıya aittir.")
    expect(system).toContain("Seçilen ayar: Ayrıntılı yaz")
    expect(system.indexOf("Değişmez kurallar:")).toBeGreaterThan(system.indexOf("Seçilen ayar"))
    expect(system).toMatch(/Metnin içine bağlantı/)
  })

  it("has a fake answer the gate takes, linking from the list it was sent", async () => {
    const prompt = buildPrompt({
      instruction: "x",
      fields: {
        [LINK_CHOICES_FIELD]: [
          { label: "k1", value: "Kategori: Termoslar" },
          { label: "u1", value: "Ürün: Çelik Termos" },
        ],
        name: "Termos nasıl temizlenir?",
      },
    })
    const { text } = await fakeTextConnector.complete({
      system: prompt.system,
      data: prompt.data,
      maxTokens: maxTokensOf(POST_DRAFT_TASK),
      json: true,
    })
    const result = postDraftOf(text, ALLOWED)
    if (!("draft" in result)) {
      throw new Error(`refused: ${result.problems.join(", ")}`)
    }
    expect(result.draft.links.map((each) => each.code)).toEqual(["k1", "u1"])
  })
})
