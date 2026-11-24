import path from "node:path"
import { hydrateFaq } from "../../../workflows/storefront/layout-hydrate-text"
import { layoutDocument } from "../layout"
import { FAQ_LIMITS } from "../sections/faq"
import type { FaqSection } from "../sections/faq"
import { SECTION_VARIANTS } from "../sections/variants"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-faq.ts"
)

const PAGE = "cnt_01KSSS000000000000000000"
const para = (text: string, marks?: unknown[]) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
})
const doc = (...content: unknown[]) => ({ type: "doc", content })
const answer = doc(para("Hafta içi 16:00'ya kadar aynı gün."), para("Ayrıntı için ", undefined))
const faq = (more: Record<string, unknown> = {}) => ({
  id: "sssbolumu",
  type: "faq",
  title: null,
  items: [{ question: "Kargo ne zaman?", body: answer }],
  ...more,
})
const issues = (layout: Record<string, unknown>) =>
  layoutDocument.safeParse(layout).error?.issues.map((issue) => issue.message) ?? []
const onPage = (section: Record<string, unknown>) => ({
  pages: [{ page_id: PAGE, sections: [section] }],
})

describe("the FAQ's own rows (adr/0073 Ek 2026-11-24 (2))", () => {
  it("takes a rich answer, a group heading and a plain answer from before, on every page", () => {
    const items = [
      { heading: "Kargo" },
      { question: "Kargo ne zaman?", body: answer },
      { question: "Kaç günde gelir?", answer: "1-3 iş günü; {telefon} arayın." },
    ]
    const read = layoutDocument.parse({
      home: [faq({ items })],
      product: [faq({ id: "sssurun001", items })],
      category: [faq({ id: "ssskategori", items, placement: "top" })],
    })

    expect(read.home[0]).toMatchObject({ variant: "standard", items })
    expect(read.category[0]).toMatchObject({ variant: "standard", placement: "top", items })
  })

  it("takes paragraphs, lists, bold, italic and links in an answer, within its characters", () => {
    const rich = doc(
      para("Kalın", [{ type: "bold" }]),
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [para("İade politikası")] }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "sayfası",
            marks: [{ type: "link", attrs: { href: "/sayfa/iade" } }],
          },
        ],
      }
    )
    expect(issues({ home: [faq({ items: [{ question: "İade?", body: rich }] })] })).toEqual([])
    const long = doc(para("a".repeat(FAQ_LIMITS.answerChars + 1)))
    expect(issues({ home: [faq({ items: [{ question: "Uzun?", body: long }] })] })).toEqual([
      "storefront_layout.faq_answer_invalid",
    ])
  })

  it.each([
    ["a heading inside an answer", doc({ type: "heading", attrs: { level: 2 }, content: [] })],
    ["a picture", doc({ type: "image", attrs: { src: "https://cdn.example/a.webp" } })],
    ["no words", doc(para(" "))],
    ["an empty document", doc()],
    [
      "a script address",
      doc({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "x",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      }),
    ],
  ])("refuses an answer with %s", (_, body) => {
    expect(issues({ home: [faq({ items: [{ question: "Soru?", body }] })] })).toEqual([
      "storefront_layout.faq_answer_invalid",
    ])
  })

  it("refuses an unknown shop detail in a rich answer", () => {
    const body = doc(para("{telfon} arayın"))
    expect(issues({ home: [faq({ items: [{ question: "Soru?", body }] })] })).toEqual([
      "storefront_layout.token_unknown",
    ])
  })

  it.each([
    ["a question with two answers", { question: "Soru?", body: answer, answer: "Düz" }],
    ["a question with no answer", { question: "Soru?" }],
    ["a heading with a question", { heading: "Kargo", question: "Soru?" }],
    ["a heading with an answer", { heading: "Kargo", body: answer }],
    ["a field no row has", { question: "Soru?", body: answer, html: "<p>x</p>" }],
  ])("refuses %s", (_, row) => {
    expect(issues({ home: [faq({ items: [row] })] })).not.toEqual([])
  })

  it("refuses a question past its characters and a heading past its", () => {
    const question = "a".repeat(FAQ_LIMITS.question + 1)
    const heading = "a".repeat(FAQ_LIMITS.heading + 1)
    expect(issues({ home: [faq({ items: [{ question, body: answer }] })] })).not.toEqual([])
    expect(
      issues({ home: [faq({ items: [{ heading }, { question: "Soru?", body: answer }] })] })
    ).not.toEqual([])
    expect(
      issues({
        home: [faq({ items: Array.from({ length: FAQ_LIMITS.items }, () => ({ heading: "B" })) })],
      })
    ).toEqual([])
  })

  it("takes the questions page on a content page only", () => {
    expect(issues(onPage(faq({ variant: "page" })))).toEqual([])
    expect(issues({ home: [faq({ variant: "page" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(SECTION_VARIANTS.faq).toEqual(["standard", "page"])
  })

  it("mirrors the contract's bounds", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(FAQ_LIMITS).toEqual(contract["FAQ_LIMITS"])
  })
})

describe("the FAQ as the store API prints it", () => {
  const section = (more: Record<string, unknown> = {}): FaqSection => {
    const read = layoutDocument.parse(onPage(faq(more)))
    return read.pages[0]?.sections[0] as FaqSection
  }
  const values = { name: "Bıçakçı", phone: "0212 000 00 00" } as never

  it("prints a section from before rich answers as it did", () => {
    const printed = hydrateFaq(section({ items: [{ question: "Kargo?", answer: "Aynı gün." }] }), {
      values,
    })
    expect(printed).toEqual({
      id: "sssbolumu",
      type: "faq",
      title: null,
      items: [{ question: "Kargo?", answer: "Aynı gün." }],
    })
  })

  it("prints a rich answer as the backend's HTML, a heading as written, the variant off its default", () => {
    const body = doc(para("Kalın", [{ type: "bold" }]), para("<b>değil</b>"))
    const printed = hydrateFaq(
      section({
        variant: "page",
        open_first: "on",
        items: [{ heading: "Kargo" }, { question: "Ne zaman?", body }],
      }),
      { values }
    )
    expect(printed).toEqual({
      id: "sssbolumu",
      type: "faq",
      title: null,
      items: [
        { heading: "Kargo" },
        {
          question: "Ne zaman?",
          html: "<p><strong>Kalın</strong></p><p>&lt;b&gt;değil&lt;/b&gt;</p>",
        },
      ],
      variant: "page",
      open_first: "on",
    })
  })
})
