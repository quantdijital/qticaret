import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreProductSection } from "@qticaret/types"
import type { StoreProgram } from "@qticaret/types/section-program"
import { t } from "@/lib/i18n"
import { StoreApiError } from "@/lib/store-api/errors"

// adr/0078: the product page's program section, from the product's own steps
const server = vi.hoisted(() => ({ storeGet: vi.fn(), storePublicGet: vi.fn() }))
vi.mock("@/lib/store-api/server", () => server)

const { programSteps, programTabOf, programView } = await import("../program")

type ProgramSection = Extract<StoreProductSection, { type: "program" }>

const PROGRAM: StoreProgram = {
  unit: "day",
  steps: [
    {
      label: null,
      title: "Göreme",
      body_html: "<p>Vadiler</p>",
      image: {
        url: "https://cdn.example.com/goreme.webp",
        alt: null,
        width: 1600,
        height: 900,
        derivatives: null,
      },
      tags: ["dinner", "breakfast", "breakfast"],
    },
    { label: "Son gün", title: "Dönüş", body_html: "  ", image: null, tags: [] },
  ],
}

const section = (extra: Partial<ProgramSection> = {}): ProgramSection => ({
  id: "program-1",
  type: "program",
  title: null,
  variant: "accordion",
  ...extra,
})

const PRODUCT = { id: "prod_1", categoryIds: [] }

describe("programSteps", () => {
  it("numbers an unlabelled step by the unit, keeps a shop's own label, names the tags", () => {
    const [first, last] = programSteps(PROGRAM, t)
    expect(first).toMatchObject({ label: "1. Gün", title: "Göreme", bodyHtml: "<p>Vadiler</p>" })
    // The picture's alt falls back to the step's title
    expect(first?.image).toMatchObject({ src: PROGRAM.steps[0]?.image?.url, alt: "Göreme" })
    expect(first?.tags).toEqual([
      { key: "breakfast", label: "Kahvaltı" },
      { key: "dinner", label: "Akşam yemeği" },
    ])
    expect(last).toMatchObject({ label: "Son gün", bodyHtml: null, image: null, tags: [] })
    expect(programSteps({ ...PROGRAM, unit: "step" }, t)[0]?.label).toBe("1. Adım")
  })
})

describe("programView", () => {
  beforeEach(() => {
    server.storeGet.mockReset()
  })

  it("draws the product's steps in the shop's variant, titled Program by default", async () => {
    server.storeGet.mockResolvedValue({ program: PROGRAM })
    const view = await programView(section(), t, PRODUCT)
    expect(server.storeGet).toHaveBeenCalledWith("/store/products/prod_1/program")
    expect(view).toMatchObject({
      id: "program-1",
      type: "program",
      title: "Program",
      variant: "accordion",
    })
    const own = await programView(
      section({ title: "Tur akışı", variant: "nope" as never }),
      t,
      PRODUCT
    )
    // A variant this build does not know reads as the timeline
    expect(own).toMatchObject({ title: "Tur akışı", variant: "timeline" })
  })

  it("leaves the section out without a product, without steps, or when the read fails", async () => {
    expect(await programView(section(), t, undefined)).toBeNull()
    server.storeGet.mockResolvedValue({ program: null })
    expect(await programView(section(), t, { id: "prod_2", categoryIds: [] })).toBeNull()
    server.storeGet.mockResolvedValue({ program: { unit: "day", steps: [] } })
    expect(await programView(section(), t, { id: "prod_3", categoryIds: [] })).toBeNull()
    server.storeGet.mockRejectedValue(new StoreApiError(404, null, null))
    expect(await programView(section(), t, { id: "prod_4", categoryIds: [] })).toBeNull()
  })
})

// The program among the description's tabs (`place: tab`); its own section by default
describe("the program's place", () => {
  it("marks a tab only when the shop asks for one", async () => {
    server.storeGet.mockResolvedValue({ program: PROGRAM })
    const own = await programView(section(), t, { id: "prod_5", categoryIds: [] })
    expect(own).not.toHaveProperty("place")
    const tab = await programView(section({ place: "tab" }), t, { id: "prod_6", categoryIds: [] })
    expect(tab).toMatchObject({ place: "tab" })
  })

  it("takes a tabbed program out of the sections, and leaves its own section where it was", async () => {
    server.storeGet.mockResolvedValue({ program: PROGRAM })
    const text = { id: "metin1", type: "rich_text" } as never
    const own = await programView(section(), t, { id: "prod_7", categoryIds: [] })
    const tab = await programView(section({ place: "tab" }), t, { id: "prod_8", categoryIds: [] })
    if (!own || !tab) {
      throw new Error("the program is drawn")
    }
    expect(programTabOf([own, text])).toEqual({ sections: [own, text], program: null })
    expect(programTabOf([text, tab])).toEqual({ sections: [text], program: tab })
  })
})
