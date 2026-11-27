import path from "node:path"
import { layoutDocument } from "../layout"
import { TOP_SLIDER_DEFAULTS, TOP_SLIDER_SETTINGS } from "../sections/top-slider"

const IMAGE = { url: "/static/serit-1.webp", alt: "Kış indirimi: tüm bıçaklarda %20" }
const slider = (more: Record<string, unknown> = {}) => ({
  id: "kaydirici01",
  type: "top_slider",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

/** The top image slider (owner 2026-11-27): its own section in the header group. */
describe("the top image slider", () => {
  it("is added empty, its steps the defaults", () => {
    const doc = layoutDocument.parse({ header: [slider()] })
    expect(doc.header[0]).toEqual({
      ...slider(),
      visible: true,
      starts_at: null,
      ends_at: null,
      slides: [],
      ...TOP_SLIDER_DEFAULTS,
    })
  })

  it("keeps its slides: a picture with its words, a phone's own, a link", () => {
    const link = { kind: "system" as const, target: "shop" as const, label: null }
    const slide = { image: IMAGE, mobile_image: { url: "/static/serit-1-m.webp", alt: null }, link }
    const set = { height: "tall", interval: "fast", transition: "fade", arrows: "off", dots: "on" }
    const doc = layoutDocument.parse({ header: [slider({ slides: [slide], ...set })] })
    expect(doc.header[0]).toMatchObject({ slides: [slide], ...set })
  })

  it("refuses a slide without words for its picture, a seventh slide, a step off its list", () => {
    expect(
      issues({ header: [slider({ slides: [{ image: { url: IMAGE.url, alt: null } }] })] })
    ).not.toEqual([])
    expect(
      issues({ header: [slider({ slides: Array.from({ length: 7 }, () => ({ image: IMAGE })) })] })
    ).not.toEqual([])
    expect(issues({ header: [slider({ height: "huge" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(
      issues({
        header: [slider({ slides: [{ image: { url: "javascript:alert(1)", alt: "x" } }] })],
      })
    ).not.toEqual([])
  })

  it("stands once in the header, beside the text strip and the scrolling strip", () => {
    const bar = { id: "duyuru0001", type: "announcement_bar", lines: ["Kargo bedava"] }
    expect(issues({ header: [slider(), bar] })).toEqual([])
    expect(issues({ header: [slider(), slider({ id: "kaydirici02" })] })).toEqual([
      "storefront_layout.section_duplicate",
    ])
  })
})

describe("the top image slider's steps", () => {
  it("mirror the contract's lists", () => {
    const contract = jest.requireActual<Record<string, unknown>>(
      path.resolve(__dirname, "../../../../../../packages/types/src/store/section-top-slider.ts")
    )
    expect(TOP_SLIDER_SETTINGS).toEqual(contract["TOP_SLIDER_SETTINGS"])
    expect(TOP_SLIDER_DEFAULTS).toEqual(contract["TOP_SLIDER_DEFAULTS"])
  })
})
