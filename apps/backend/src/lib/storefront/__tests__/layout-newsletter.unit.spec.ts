import path from "node:path"
import { layoutDocument, readStoredLayout } from "../layout"
import {
  NEWSLETTER_CONSENT_STYLES,
  NEWSLETTER_LIMITS,
  NEWSLETTER_TONES,
  newsletterImages,
  printedNewsletter,
} from "../sections/newsletter"
import { SECTION_VARIANTS } from "../sections/variants"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const contract = (file: string) =>
  jest.requireActual<Record<string, unknown>>(
    path.resolve(__dirname, `../../../../../../packages/types/src/store/${file}.ts`)
  )

const SCHEDULE = { visible: true, starts_at: null, ends_at: null }
const ALWAYS = { ...SCHEDULE, device: "all" }
const PICTURE = { url: "https://cdn.example.com/media/bulten.jpg", alt: "Atölye" }
const box = (more: Record<string, unknown> = {}) => ({
  id: "ebultenkutu",
  type: "newsletter",
  title: null,
  text: null,
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []
const same = (text: string | null) => text
const asIs = (url: string, alt: string | null) => ({ url, alt })

describe("the newsletter box's variants (adr/0049 Ek 2026-11-17 e-bülten)", () => {
  it("reads a box saved before the variants as the standard one, on a page and in the footer", () => {
    const doc = layoutDocument.parse({ home: [box()], footer: [box({ id: "altbulten" })] })

    expect(doc.home[0]).toEqual({ ...box(), ...ALWAYS, variant: "standard", description: null })
    expect(doc.footer[0]).toEqual({
      ...box({ id: "altbulten" }),
      ...SCHEDULE,
      variant: "standard",
      description: null,
    })
  })

  it("starts the promise line shown, and keeps a picture only on the picture card", () => {
    const doc = layoutDocument.parse({
      home: [box({ variant: "split" })],
      product: [box({ id: "urunbulten", variant: "image_card", image: PICTURE })],
      category: [box({ id: "katbulten", variant: "strip", placement: "top" })],
    })

    expect(doc.home[0]).toMatchObject({ variant: "split", note: null, show_note: true })
    expect(doc.product[0]).toMatchObject({ variant: "image_card", image: PICTURE })
    expect(doc.category[0]).toMatchObject({ variant: "strip", placement: "top" })
    expect(issues({ home: [box({ variant: "strip", image: PICTURE })] })).not.toEqual([])
    expect(issues({ home: [box({ variant: "standard", note: "Ayda bir" })] })).not.toEqual([])
  })

  it("takes the footer column variant only in the footer", () => {
    expect(issues({ footer: [box({ variant: "in_footer" })] })).toEqual([])
    expect(issues({ home: [box({ variant: "in_footer" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ footer: [box({ variant: "bento" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("refuses a picture off the shop's storage, a control character in the words, an overlong line", () => {
    const off = { url: "javascript:alert(1)", alt: null }
    expect(issues({ home: [box({ variant: "image_card", image: off })] })).toContain(
      "storefront_layout.image_invalid"
    )
    expect(issues({ home: [box({ description: "satır\u0007sonu" })] })).toContain(
      "storefront_layout.text_invalid"
    )
    expect(
      issues({ footer: [box({ variant: "split", note: "a".repeat(NEWSLETTER_LIMITS.note + 1) })] })
    ).not.toEqual([])
    expect(issues({ home: [box({ description: "{bilinmeyen} haber" })] })).toContain(
      "storefront_layout.token_unknown"
    )
  })

  it("reads a stored box of a variant this build lost as the standard one, its words kept", () => {
    const doc = readStoredLayout({
      home: [box({ variant: "bento", description: "Haberler", note: "Ayda bir" })],
    })

    expect(doc.home[0]).toMatchObject({ variant: "standard", description: "Haberler" })
    expect(doc.home[0]).not.toHaveProperty("note")
  })

  it("prints a standard box as before, and each new field only off its default", () => {
    const doc = layoutDocument.parse({
      home: [
        box(),
        box({ id: "yanyana", variant: "split", show_note: false, description: "Haber" }),
        box({ id: "gorselli", variant: "image_card", image: PICTURE, note: "Ayda bir" }),
      ],
      footer: [box({ id: "altbulten", variant: "in_footer" })],
    })
    const [standard, split, card] = doc.home

    expect(printedNewsletter(standard as never, same, asIs)).toEqual(box({ id: "ebultenkutu" }))
    expect(printedNewsletter(split as never, same, asIs)).toEqual({
      ...box({ id: "yanyana" }),
      variant: "split",
      description: "Haber",
      show_note: false,
    })
    expect(printedNewsletter(card as never, same, asIs)).toEqual({
      ...box({ id: "gorselli" }),
      variant: "image_card",
      note: "Ayda bir",
      image: PICTURE,
    })
    expect(printedNewsletter(doc.footer[0] as never, same, asIs)).toEqual({
      ...box({ id: "altbulten" }),
      variant: "in_footer",
    })
    expect(newsletterImages(card as never)).toEqual([PICTURE.url])
    expect(newsletterImages(split as never)).toEqual([])
  })

  it("mirrors the contract's lists", () => {
    expect(SECTION_VARIANTS.newsletter).toEqual(
      (contract("section-variants")["SECTION_VARIANTS"] as Record<string, unknown>)["newsletter"]
    )
    expect(NEWSLETTER_LIMITS).toEqual(contract("section-newsletter")["NEWSLETTER_LIMITS"])
    expect(NEWSLETTER_TONES).toEqual(contract("section-newsletter")["NEWSLETTER_TONES"])
    expect(NEWSLETTER_CONSENT_STYLES).toEqual(
      contract("section-newsletter")["NEWSLETTER_CONSENT_STYLES"]
    )
  })
})

describe("the newsletter box's consent setting (box or one small line)", () => {
  it("takes the line on every variant, page and footer, and prints it only when set", () => {
    const line = layoutDocument.parse({
      home: [box({ consent_style: "line" })],
      footer: [box({ id: "altbulten", variant: "in_footer", consent_style: "line" })],
    })
    const plain = layoutDocument.parse({ home: [box({ id: "seritkutu", variant: "strip" })] })

    expect(printedNewsletter(line.home[0] as never, same, asIs)).toEqual(
      box({ consent_style: "line" })
    )
    expect(printedNewsletter(line.footer[0] as never, same, asIs)).toMatchObject({
      consent_style: "line",
    })
    expect(printedNewsletter(plain.home[0] as never, same, asIs)).toEqual({
      ...box({ id: "seritkutu" }),
      variant: "strip",
    })
  })

  it("refuses a style it does not know", () => {
    expect(issues({ home: [box({ consent_style: "popover" })] })).not.toEqual([])
  })
})
