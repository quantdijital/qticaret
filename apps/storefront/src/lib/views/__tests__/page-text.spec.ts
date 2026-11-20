import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LegalIdentity, StoreContactSection } from "@qticaret/types"
import type * as Legal from "../legal"
import type { StorePageText } from "../page-text"

const IDENTITY: LegalIdentity = {
  company_title: "Örnek Atölye Ltd. Şti.",
  mersis: "0123456789000015",
  tax_office: null,
  tax_number: null,
  address: null,
  kep: null,
  etbis: null,
  same_as: [],
  email: "bilgi@example.com",
  phone: "+905320000000",
  whatsapp: null,
  opening_hours: [],
  map_url: null,
}

const requests = vi.hoisted(() => ({ legalIdentity: vi.fn() }))
vi.mock("@/lib/store-api/requests", () => requests)
const auth = vi.hoisted(() => ({ currentCustomer: vi.fn() }))
vi.mock("@/lib/account/auth", () => auth)
const legal = vi.hoisted(() => ({ legalDocument: vi.fn() }))
vi.mock("../legal", async (actual) => ({
  ...(await actual<typeof Legal>()),
  legalDocument: legal.legalDocument,
}))
const facts = vi.hoisted(() => ({ paymentFacts: vi.fn(), shippingFacts: vi.fn() }))
vi.mock("../page-facts", () => facts)

const { pageTextView } = await import("../page-text")

const t = (key: string) => key
/** The page's opening text, its anchors from a page of no others. */
const opening = () => ({ opens: true, anchors: new Set<string>() })

const article = (over: Partial<Extract<StorePageText, { type: "rich_text" }>> = {}) =>
  ({
    id: "metin",
    type: "rich_text",
    variant: "article",
    title: null,
    html: "<p>Atölye.</p>",
    ...over,
  }) as const

const QUESTIONS =
  "<h2>Kargo</h2>" +
  "<p><strong>Ne zaman gelir?</strong></p><p>1-4 gün.</p>" +
  "<p><strong>Ücreti ne?</strong></p><p>Ücretsiz.</p>" +
  "<p><strong>Takip edilir mi?</strong></p><p>Evet.</p>"

const LONG = "<h2>Bir</h2><p>a</p><h2>İki</h2><p>b</p><h2>Üç</h2><p>c</p>"

/** The page's text sections read as the page read its text and its role's parts (adr/0073 Ek 2026-11-19 (2) K2). */
describe("a content page's text sections", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requests.legalIdentity.mockResolvedValue(IDENTITY)
    auth.currentCustomer.mockResolvedValue(null)
    legal.legalDocument.mockResolvedValue({ title: "KVKK Aydınlatma Metni" })
  })

  it("reads a text of questions into its groups, the ways to reach the shop beside them", async () => {
    const view = await pageTextView(article({ html: QUESTIONS }), t, opening())
    expect(view).toMatchObject({ id: "metin", variant: "article", outline: [] })
    if (view?.type !== "rich_text") throw new Error("not a text")
    expect(view.faq?.groups[0]?.items).toHaveLength(3)
    expect(view.help?.email).toBe("bilgi@example.com")
    // `questions: off`: an ordinary text, its headings anchored
    const off = await pageTextView(article({ html: QUESTIONS, questions: "off" }), t, opening())
    expect(off).toMatchObject({ faq: null, help: null })
  })

  it("anchors a long text's headings for its contents, unless the shop switched them off", async () => {
    const view = await pageTextView(article({ html: LONG, title: "Rehber" }), t, opening())
    expect(view).toMatchObject({
      title: "Rehber",
      outline: [
        { id: "bir", label: "Bir" },
        { id: "iki", label: "İki" },
        { id: "uc", label: "Üç" },
      ],
      html: expect.stringContaining('<h2 id="bir">Bir</h2>') as unknown,
    })
    const off = await pageTextView(article({ html: LONG, outline: "off" }), t, opening())
    expect(off).toMatchObject({ outline: [], html: LONG })
  })

  it("anchors two texts of one page apart, sharing the page's anchors", async () => {
    const place = opening()
    const one = await pageTextView(article({ html: LONG }), t, place)
    const two = await pageTextView(article({ id: "ikinci", html: LONG }), t, {
      ...place,
      opens: false,
    })
    const anchors = [one, two].flatMap((view) =>
      view?.type === "rich_text" ? view.outline.map((item) => item.id) : []
    )
    expect(anchors).toEqual(["bir", "iki", "uc", "bir-2", "iki-2", "uc-2"])
  })

  it("prints the text's library pictures in their versions, the opening one at once only", async () => {
    const html = '<p><img src="https://cdn.example.com/a.jpg" alt="A"></p>'
    const images = [
      { url: "https://cdn.example.com/a.jpg", width: 800, height: 600, derivatives: null },
    ]
    const first = await pageTextView(article({ html, images }), t, opening())
    const later = await pageTextView(article({ html, images }), t, {
      opens: false,
      anchors: new Set<string>(),
    })
    if (first?.type !== "rich_text" || later?.type !== "rich_text") throw new Error("not a text")
    expect(first.html).toContain('width="800"')
    expect(first.html).toContain('loading="eager"')
    expect(later.html).toContain('loading="lazy"')
  })

  it("fills the contact form for a signed-in customer and shows the imprint, as switched", async () => {
    auth.currentCustomer.mockResolvedValue({
      first_name: "Ayşe",
      last_name: "Yılmaz",
      email: "ayse@example.com",
    })
    const section: StoreContactSection = {
      id: "iletisim",
      type: "contact",
      html: "<p>Yazın.</p>",
      images: [],
      headings: [],
      form: "on",
      imprint: "on",
    }
    const view = await pageTextView(section, t, opening())
    expect(view).toMatchObject({
      type: "contact",
      html: "<p>Yazın.</p>",
      form: {
        name: "Ayşe Yılmaz",
        email: "ayse@example.com",
        privacyPath: "/yasal/kvkk-aydinlatma-metni",
      },
      contact: { email: "bilgi@example.com" },
    })
    if (view?.type !== "contact") throw new Error("not the contact section")
    expect(view.identity.map((row) => row.value)).toContain("0123456789000015")
    const off = await pageTextView({ ...section, form: "off", imprint: "off" }, t, opening())
    expect(off).toMatchObject({ form: null, identity: [] })
    // Nobody is asked about the customer when there is no form
    expect(auth.currentCustomer).toHaveBeenCalledTimes(1)
  })

  it("gives the live facts, and leaves a facts section with nothing to show out", async () => {
    const shipping = { carriers: [], promises: [{ icon: "truck", title: "Kargo", text: null }] }
    facts.shippingFacts.mockResolvedValue(shipping)
    facts.paymentFacts.mockResolvedValue(null)
    expect(await pageTextView({ id: "k", type: "shipping_facts" }, t, opening())).toEqual({
      id: "k",
      type: "shipping_facts",
      shipping,
    })
    expect(await pageTextView({ id: "o", type: "payment_facts" }, t, opening())).toBeNull()
  })
})
