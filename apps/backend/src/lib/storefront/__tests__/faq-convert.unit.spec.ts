import { renderDoc } from "../../content"
import type { ContentDoc } from "../../content"
import { convertFaqPages } from "../faq-convert"
import { faqDoc, faqRowsOf } from "../faq-text"
import { layoutDocument } from "../layout"
import { pageMirror } from "../page-text"
import { isFaqHeading } from "../sections/faq"
import type { FaqRow } from "../sections/faq"

const PAGE = "cnt_01KSSS000000000000000000"
const OTHER = "cnt_01KABOUT0000000000000000"
const BOLD = [{ type: "bold" }]
const para = (text: string, marks?: unknown[]) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
})
const h = (level: number, text: string) => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
})
const doc = (...content: unknown[]) => ({ type: "doc", content }) as ContentDoc
const link = {
  type: "paragraph",
  content: [
    { type: "text", text: "Ayrıntılar için " },
    {
      type: "text",
      text: "İade & Değişim Politikası",
      marks: [{ type: "link", attrs: { href: "/iade-politikasi" } }],
    },
    { type: "text", text: " sayfamıza göz atabilirsiniz." },
  ],
}

// The shop's questions page as it was written: three groups (h3), bold questions, a link
const SSS = doc(
  h(3, "Nasıl Satın Alırım?"),
  para("Üye olmam gerekiyor mu?", BOLD),
  para("Hayır, misafir olarak sipariş verebilirsiniz."),
  para("Ne zaman kargoya verilir?", BOLD),
  para("Hafta içi 16:00'a kadar verilen siparişler aynı gün."),
  { type: "paragraph", content: [] },
  h(3, "Ödeme Yöntemleri"),
  para("Ödemelerim güvenli mi?", BOLD),
  para("Evet, tüm ödemeler korunur."),
  h(3, "Geri Ödeme & İade"),
  para("Hangi ürünlerde iade yapılamaz?", BOLD),
  para("Kişiye özel üretilmiş ürünlerde."),
  link
)

const article = (id: string, body: ContentDoc, more: Record<string, unknown> = {}) => ({
  id,
  type: "rich_text",
  variant: "article",
  title: null,
  body,
  ...more,
})
const design = (sections: unknown[], others: unknown[] = []) =>
  JSON.parse(JSON.stringify({ pages: [{ page_id: PAGE, sections }, ...others] })) as Record<
    string,
    unknown
  >
const sectionsOf = (stored: Record<string, unknown>, pageId = PAGE) =>
  layoutDocument.parse(stored).pages.find((each) => each.page_id === pageId)?.sections ?? []

describe("a text of questions read into an FAQ's rows (adr/0073 Ek 2026-11-24 (2))", () => {
  it("reads the groups and their bold questions, each answer what follows it", () => {
    const rows = faqRowsOf(SSS)
    expect(rows?.map((row) => (isFaqHeading(row) ? `# ${row.heading}` : row.question))).toEqual([
      "# Nasıl Satın Alırım?",
      "Üye olmam gerekiyor mu?",
      "Ne zaman kargoya verilir?",
      "# Ödeme Yöntemleri",
      "Ödemelerim güvenli mi?",
      "# Geri Ödeme & İade",
      "Hangi ürünlerde iade yapılamaz?",
    ])
  })

  it("keeps each answer's HTML as the text printed it (the empty paragraph prints nothing)", () => {
    const rows = faqRowsOf(SSS) ?? []
    const last = rows.at(-1) as Exclude<FaqRow, { heading: string }>
    expect(renderDoc(last.body ?? { type: "doc", content: [] })).toBe(
      '<p>Kişiye özel üretilmiş ürünlerde.</p><p>Ayrıntılar için <a href="/iade-politikasi">İade &amp; Değişim Politikası</a> sayfamıza göz atabilirsiniz.</p>'
    )
  })

  it("reads asking headings as the questions when bold lines are fewer than three", () => {
    const rows = faqRowsOf(
      doc(
        h(2, "Kargo"),
        h(3, "Ne zaman?"),
        para("Aynı gün."),
        h(3, "Nereden?"),
        para("İstanbul."),
        h(3, "Kaça?"),
        para("Ücretsiz.")
      )
    )
    expect(rows).toEqual([
      { heading: "Kargo" },
      { question: "Ne zaman?", body: doc(para("Aynı gün.")) },
      { question: "Nereden?", body: doc(para("İstanbul.")) },
      { question: "Kaça?", body: doc(para("Ücretsiz.")) },
    ])
  })

  it.each([
    ["fewer than three questions", doc(para("A?", BOLD), para("a"), para("B?", BOLD), para("b"))],
    [
      "words before the first question",
      doc(
        para("Giriş"),
        para("A?", BOLD),
        para("a"),
        para("B?", BOLD),
        para("b"),
        para("C?", BOLD),
        para("c")
      ),
    ],
    [
      "words under a heading before its question",
      doc(
        h(2, "Grup"),
        para("Açıklama"),
        para("A?", BOLD),
        para("a"),
        para("B?", BOLD),
        para("b"),
        para("C?", BOLD),
        para("c")
      ),
    ],
    [
      "a question with no answer",
      doc(para("A?", BOLD), para("B?", BOLD), para("b"), para("C?", BOLD), para("c")),
    ],
    [
      "a quote in an answer",
      doc(
        para("A?", BOLD),
        { type: "blockquote", content: [para("a")] },
        para("B?", BOLD),
        para("b"),
        para("C?", BOLD),
        para("c")
      ),
    ],
  ])("is no FAQ with %s", (_, text) => {
    expect(faqRowsOf(text)).toBeNull()
  })

  it("writes the rows back as a text for the page's mirror: headings, bold questions, answers", () => {
    const rows = faqRowsOf(SSS) ?? []
    const written = faqDoc(rows)
    // Read again, the same rows: the mirror holds every question and answer
    expect(faqRowsOf(written)).toEqual(rows)
    expect(written.content[0]).toEqual(h(2, "Nasıl Satın Alırım?"))
    expect(faqDoc([{ question: "Eski?", answer: "Düz cevap." }])).toEqual(
      doc(para("Eski?", BOLD), para("Düz cevap."))
    )
  })
})

describe("the questions pages turned into FAQs, once", () => {
  it("puts an FAQ drawn as the text was in the text's place, the text kept after it, hidden", () => {
    const stored = design([article("sssmetni01", SSS, { title: "Sorular" })])
    const { document, count } = convertFaqPages(stored)

    expect(count).toEqual({ converted: 1, left: 0 })
    const [faq, kept] = sectionsOf(document)
    expect(faq).toMatchObject({
      type: "faq",
      variant: "page",
      title: "Sorular",
      visible: true,
      open_first: "off",
      single_open: "off",
      items: faqRowsOf(SSS),
    })
    expect(kept).toMatchObject({ id: "sssmetni01", visible: false, questions: "auto", body: SSS })
    // The page's mirror is still every question and answer
    expect(faqRowsOf(pageMirror(sectionsOf(document)))).toEqual(
      faqRowsOf(pageMirror(sectionsOf(stored)))
    )
  })

  it("writes nothing on a second run, nor for a page with no questions text", () => {
    const once = convertFaqPages(design([article("sssmetni01", SSS)])).document
    const again = convertFaqPages(once)
    expect(again.document).toBe(once)
    expect(again.count).toEqual({ converted: 0, left: 0 })

    const plain = design([article("hakkimizda", doc(para("Biz bir bıçak mağazasıyız.")))])
    expect(convertFaqPages(plain).document).toBe(plain)
  })

  it("leaves a text the shop switched off, a hidden one and one that would not come out the same", () => {
    const stored = design([
      article("kapali0001", SSS, { questions: "off" }),
      article("gizli00001", SSS, { visible: false }),
      article("girisli001", doc(para("Giriş"), ...SSS.content)),
    ])
    const { document, count } = convertFaqPages(stored)
    expect(document).toBe(stored)
    expect(count).toEqual({ converted: 0, left: 1 })
  })

  it("leaves a page with no room for one more section, and still turns the other pages", () => {
    const full = Array.from({ length: 11 }, (_, n) => ({
      id: `yardim${String(n).padStart(4, "0")}`,
      type: "help",
    }))
    const stored = design(
      [article("sssmetni01", SSS), ...full],
      [{ page_id: OTHER, sections: [article("sssmetni02", SSS)] }]
    )
    const { document, count } = convertFaqPages(stored)
    expect(count).toEqual({ converted: 1, left: 1 })
    expect(sectionsOf(document)[0]).toMatchObject({ type: "rich_text", visible: true })
    expect(sectionsOf(document, OTHER)[0]).toMatchObject({ type: "faq", variant: "page" })
  })
})
