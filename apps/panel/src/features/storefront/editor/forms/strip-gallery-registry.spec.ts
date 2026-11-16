import { describe, expect, it } from "vitest"
import { i18next } from "@/lib/i18n"
import type { StripGallerySection, StripItem } from "@/features/storefront/api/layout"
import { lookFieldsFor } from "@/features/storefront/layout/look"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { HOME_TYPES, newHomeSection } from "@/features/storefront/layout/sections"
import { lostReason } from "../lost-reason"
import { sectionLabel } from "../section-meta"
import { contentFields } from "./content-registry"
import { FIELD_IDS } from "./field-registry"
import { PREVIEW_IDS, previewField } from "./preview-fields"
import { newStripItem, withKind, withTarget } from "./strip-items"

const ID = "seritler01"

const item = (over: Partial<StripItem> = {}): StripItem => ({
  source: { kind: "product", target: "p1" },
  image: null,
  title: null,
  note: null,
  link: null,
  ...over,
})
const gallery = (items: StripItem[], over: Partial<StripGallerySection> = {}) => ({
  ...(newHomeSection("strip_gallery", ID) as StripGallerySection),
  items,
  ...over,
})

describe("the strip gallery in the chooser and the tree (adr/0049 Ek 2026-11-16)", () => {
  it("is offered on the home page after the picture band, named in both languages", () => {
    expect(HOME_TYPES.indexOf("strip_gallery")).toBe(HOME_TYPES.indexOf("banner") + 1)
    expect(i18next.t("storefront.editor.types.strip_gallery.name")).toBe("Çapraz şeritler")
    expect(i18next.t("storefront.editor.types.strip_gallery.name", { lng: "en" })).toBe(
      "Slanted strips"
    )
  })

  it("shows the shop's heading in the tree, and counts as filled by the shop", () => {
    const t = i18next.t.bind(i18next)
    expect(sectionLabel(t, gallery([], { title: "Koleksiyonlar" }))).toEqual({
      name: "Koleksiyonlar",
      detail: "Çapraz şeritler",
    })
    expect(lostReason(gallery([]), { own: false, blocked: false })).toBe("empty")
  })

  it("has its own width, so the look's is not offered beside it", () => {
    expect(lookFieldsFor("strip_gallery")).not.toContain("width")
  })
})

describe("a strip's source changed", () => {
  it("keeps the shop's picture, words and link; a record kept only within its kind", () => {
    const own = item({
      image: { url: "/a.webp", alt: "Bıçak" },
      title: "Bizim",
      note: "Yeni",
      link: { kind: "url", url: "https://a.example", label: "Git" },
    })
    const free = { image: own.image, title: own.title, note: own.note, link: own.link }
    expect(withKind(own, "category")).toEqual({
      ...free,
      source: { kind: "category", target: "" },
    })
    expect(withKind(own, "product")).toEqual(own)
    expect(withKind(own, "custom")).toEqual({ ...free, source: { kind: "custom" } })
    expect(withTarget(withKind(own, "brand"), "b1").source).toEqual({ kind: "brand", target: "b1" })
    expect(withTarget(withKind(own, "custom"), "b1").source).toEqual({ kind: "custom" })
    expect(newStripItem()).toEqual(item({ source: { kind: "product", target: "" } }))
  })
})

describe("the strip gallery's problems", () => {
  it("wants two strips at least", () => {
    expect(sectionProblems(gallery([item()]))).toEqual({ items: "stripsTwo" })
    expect(sectionProblems(gallery([item(), item()]))).toEqual({})
  })

  it("wants a custom strip's picture and a source's record, named by its kind", () => {
    const problems = sectionProblems(
      gallery([
        item({ source: { kind: "custom" } }),
        item({ source: { kind: "product", target: "" } }),
        item({ source: { kind: "category", target: "" } }),
        item({ source: { kind: "collection", target: "" } }),
        item({ source: { kind: "brand", target: "" } }),
      ])
    )
    expect(problems).toEqual({
      "items.0.image": "imageRequired",
      "items.1.source": "productRequired",
      "items.2.source": "categoryRequired",
      "items.3.source": "collectionRequired",
      "items.4.source": "brandRequired",
    })
  })

  it("checks the words' lengths, the links and the section's heading and line", () => {
    const problems = sectionProblems(
      gallery(
        [
          item({ title: "a".repeat(61), note: "b".repeat(81) }),
          item({
            image: { url: "/a.webp", alt: "x".repeat(301) },
            link: { kind: "url", url: "https://a.example", label: " " },
          }),
        ],
        { title: "t".repeat(61), text: "{bilinmeyen}" }
      )
    )
    expect(problems).toEqual({
      title: "tooLong",
      text: "tokenUnknown",
      "items.0.title": "tooLong",
      "items.0.note": "tooLong",
      "items.1.image": "tooLong",
      "items.1.link": "linkLabel",
    })
  })
})

describe("the strip gallery in the settings search and the live preview", () => {
  it("finds its seven settings in the open Diziliş group, each with its term", () => {
    const fields = contentFields(gallery([]))
    expect(fields.map((field) => `${field.group}:${field.key}`)).toEqual([
      "layout:width",
      "layout:height",
      "layout:captions",
      "layout:strips_slant",
      "layout:strips_line",
      "layout:strips_overlap",
      "layout:strips_dim",
    ])
    for (const field of fields) {
      expect(i18next.exists(field.label)).toBe(true)
      expect(field.term && i18next.t(field.term)).toBe(field.key)
      for (const option of field.options) expect(i18next.exists(option)).toBe(true)
    }
    expect(fields[0]?.target).toBe(FIELD_IDS.content(ID, "width"))
  })

  it("opens a strip's dialog at the field the preview names, by its saved place", () => {
    const section = gallery([item(), item()])
    expect(previewField(section, "title")).toEqual({
      target: PREVIEW_IDS.text(ID, "title"),
      group: "content",
    })
    expect(previewField(section, "text")?.target).toBe(`${ID}-text`)
    for (const part of ["title", "note", "image"]) {
      expect(previewField(section, `items.1.${part}`)).toEqual({
        target: `${ID}-items-1-${part}`,
        group: "content",
        slide: 1,
      })
    }
    expect(previewField(section, "items.2.title")).toBeNull()
    expect(previewField(section, "items.0.source")).toBeNull()
    expect(previewField(section, "items.0.title.x")).toBeNull()
  })
})
