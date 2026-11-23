import type { MedusaContainer } from "@medusajs/framework/types"
import { removeDraftPages } from "../draft-page"
import { presetPageRefs } from "../../storefront/preset-pages"

const run = jest.fn()
jest.mock("../workflows", () => ({
  deleteContentWorkflow: () => ({ run }),
  saveContentWorkflow: () => ({ run: jest.fn() }),
}))
jest.mock("../../migration/content-page", () => ({ importPage: jest.fn() }))

const listContentEntries = jest.fn()
const container = { resolve: () => ({ listContentEntries }) } as unknown as MedusaContainer

describe("taking back the draft pages an apply opened (adr/0073 Ek 2026-11-19 (2) K6)", () => {
  beforeEach(() => {
    run.mockReset().mockResolvedValue({ result: {} })
    listContentEntries.mockReset()
  })

  it("deletes only a page still a draft that never went live", async () => {
    listContentEntries.mockResolvedValue([
      { id: "cnt_taslak", status: "draft", published_at: null },
      { id: "cnt_yayinda", status: "published", published_at: new Date() },
      { id: "cnt_eskiden", status: "draft", published_at: new Date() },
    ])

    await removeDraftPages(container, ["cnt_taslak", "cnt_yayinda", "cnt_eskiden", "cnt_silinmis"])

    // The shop's published (or once live) page is its own; one gone since needs nothing
    expect(run.mock.calls).toEqual([[{ input: "cnt_taslak" }]])
  })

  it("reads nothing when it opened none", async () => {
    await removeDraftPages(container, [])

    expect(listContentEntries).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })
})

describe("a look's content pages by their references (security review S9)", () => {
  it("takes a page's handle only, never another kind's record", () => {
    expect(
      presetPageRefs({
        pages: [
          { page_id: { $handle: "page:hakkimizda" }, name: "Hakkımızda" },
          { page_id: { $handle: "category:cakilar" }, name: "Çakılar" },
          { page_id: { $handle: "page:sss" } },
        ],
      })
    ).toEqual([
      { ref: "page:hakkimizda", name: "Hakkımızda" },
      { ref: "page:sss", name: null },
    ])
  })
})
