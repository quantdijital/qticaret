import { describe, expect, it } from "vitest"
import { FOOTER_BAR_DEFAULTS, FOOTER_BLOCK_TYPES } from "@qticaret/types"
import type {
  FooterBarSection,
  FooterBlock,
  FooterNewsletter,
  FooterRowsSection,
} from "@/features/storefront/api/layout"
import {
  footerBandProblem,
  footerRowsProblems,
  partHasProblem,
} from "@/features/storefront/layout/footer-rows-problems"
import {
  BLOCK_FIELDS,
  FOOTER_ROWS_FIELD_IDS as IDS,
  blockGroup,
  fieldsOfBlock,
  footerPreviewField,
  footerRowsFields,
} from "./footer-rows-fields"
import { allBlocks, newRow } from "./footer-rows-ops"
import { newBlock, seedFooter } from "./footer-rows-seed"
import { previewField } from "../forms/preview-fields"

const ledger = {
  id: "mainfooter",
  type: "footer_bar",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "ledger",
  ...FOOTER_BAR_DEFAULTS,
  payment_badges: [],
} as FooterBarSection

let counter = 0
const nextId = () => `id${++counter}`

/** A free rows footer holding `blocks`, one a column in rows of one. */
function footerOf(...blocks: FooterBlock[]): FooterRowsSection {
  const [seeded] = seedFooter([ledger], 0, nextId) as [FooterRowsSection]
  return {
    ...seeded,
    rows: blocks.map((block, at) => ({ ...newRow(`r${at}`, "1"), columns: [{ blocks: [block] }] })),
  }
}

const box = {
  id: "news",
  type: "newsletter",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "in_footer",
  title: null,
  text: null,
  description: null,
} as FooterNewsletter

describe("the free rows footer's preview keys (adr/0070 §6)", () => {
  const footer = footerOf(
    newBlock("text", "t"),
    { ...newBlock("menu", "m"), slot: 2 },
    newBlock("image", "i"),
    newBlock("newsletter", "n")
  )

  it("opens a block's panel at the field the preview named, by its place", () => {
    expect(footerPreviewField(footer, ["blocks", "3", "title"])).toEqual({
      target: IDS.block("n", "title"),
      group: "content",
      part: { kind: "block", id: "n" },
    })
    expect(footerPreviewField(footer, ["blocks", "2", "width"])?.group).toBe("appearance")
  })

  it("opens a block at its first field when only its box is named", () => {
    expect(footerPreviewField(footer, ["blocks", "1"])?.target).toBe(IDS.block("m", "slot"))
  })

  it("opens a row at its split", () => {
    expect(footerPreviewField(footer, ["rows", "1"])).toEqual({
      target: IDS.row("r1", "layout"),
      group: "columns",
      part: { kind: "row", id: "r1" },
    })
  })

  it("is what the preview bridge answers for the free rows footer", () => {
    expect(previewField(footer, "blocks.3.title")).toEqual(
      footerPreviewField(footer, ["blocks", "3", "title"])
    )
    expect(previewField(footer, "rows.0")?.part).toEqual({ kind: "row", id: "r0" })
    expect(previewField(footer, "blocks.12")).toBeNull()
  })

  it("answers null for anything the footer does not have", () => {
    expect(footerPreviewField(footer, ["blocks", "9"])).toBeNull()
    expect(footerPreviewField(footer, ["blocks", "0", "slot"])).toBeNull()
    expect(footerPreviewField(footer, ["blocks", "x"])).toBeNull()
    expect(footerPreviewField(footer, ["rows", "7"])).toBeNull()
    expect(footerPreviewField(footer, ["rows", "0", "layout"])).toBeNull()
    expect(footerPreviewField(footer, ["blocks", "0", "title", "more"])).toBeNull()
    expect(footerPreviewField(footer, ["columns", "0"])).toBeNull()
  })

  it("lists every row and block field for the settings search, each opening its part", () => {
    const entries = footerRowsFields(footer)
    const blockKeys = allBlocks(footer.rows).flatMap((block) =>
      fieldsOfBlock(block).map((field) => `blocks.${block.id}.${field}`)
    )
    expect(entries.map((entry) => entry.key)).toEqual(expect.arrayContaining(blockKeys))
    expect(entries.find((entry) => entry.key === "rows.r0.layout")?.part).toEqual({
      kind: "row",
      id: "r0",
    })
    expect(footerRowsFields(ledger)).toEqual([])
  })

  it("puts every block field in a group: words in İçerik, the look in Stil, the rest in Gelişmiş", () => {
    for (const type of FOOTER_BLOCK_TYPES) {
      for (const field of BLOCK_FIELDS[type]) {
        expect(["content", "variant", "appearance", "phone"]).toContain(blockGroup(field))
      }
    }
    expect(blockGroup("visible")).toBe("visibility")
    expect(blockGroup("device")).toBe("visibility")
  })
})

describe("the free rows footer's problems (adr/0070 §2)", () => {
  it("asks an image block for its picture and its words", () => {
    const missing = footerRowsProblems(footerOf(newBlock("image", "i")), [])
    expect(missing["blocks.i.image"]).toBe("imageRequired")
    const image = { url: "https://cdn.example/a.jpg", alt: " " } as never
    const noAlt = footerRowsProblems(footerOf({ ...newBlock("image", "i"), image }), [])
    expect(noAlt["blocks.i.image"]).toBe("required")
    expect(partHasProblem(noAlt, "blocks.i")).toBe(true)
    expect(partHasProblem(noAlt, "blocks.ii")).toBe(false)
  })

  it("takes an app's page only on its own store's host", () => {
    const at = (app_store: string | null, google_play: string | null) =>
      footerRowsProblems(footerOf({ ...newBlock("app_badges", "a"), app_store, google_play }), [])
    expect(at(null, null)["blocks.a.app_store"]).toBe("required")
    expect(at("https://apps.apple.com/app/x", null)).toEqual({})
    expect(at("https://evil.example/apps.apple.com", null)["blocks.a.app_store"]).toBe(
      "footerBlockInvalid"
    )
    expect(at(null, "http://play.google.com/store")["blocks.a.google_play"]).toBe(
      "footerBlockInvalid"
    )
  })

  it("does not take a newsletter block beside the group's newsletter box", () => {
    const footer = footerOf(newBlock("newsletter", "n"))
    expect(footerRowsProblems(footer, [box, footer])["newsletter"]).toBe("footerNewsletterTwice")
    expect(footerRowsProblems(footer, [{ ...box, visible: false }, footer])["newsletter"]).toBe(
      undefined
    )
  })

  it("marks a row whose columns do not match its split", () => {
    const footer = footerOf(newBlock("text", "t"))
    const broken = {
      ...footer,
      rows: footer.rows.map((row) => ({ ...row, layout: "1-1" as const })),
    }
    expect(footerRowsProblems(broken, [])["rows.r0"]).toBe("footerColumnsMismatch")
  })

  it("marks the group's box drawn in the footer while the footer is in free rows", () => {
    const footer = footerOf(newBlock("text", "t"))
    expect(footerBandProblem(box, [box, footer])).toBe("footerNewsletterBand")
    expect(footerBandProblem(box, [box, ledger])).toBeNull()
    expect(footerBandProblem({ ...box, variant: "standard" }, [box, footer])).toBeNull()
  })
})
