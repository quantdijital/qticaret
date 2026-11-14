import type * as Fs from "node:fs"
import type { MedusaContainer } from "@medusajs/framework/types"
import type * as SectorPacks from "@qticaret/sector-packs"
import { logger } from "../../../../lib/logging"
import { presetGallery } from "../read"

const preset = (pack: string, code: string) => ({
  pack,
  code,
  version: 1,
  theme: "atolye",
  name: code,
  description: "",
  tone: "light",
  menus: null,
  demo: null,
  preview: null,
})

jest.mock("@qticaret/sector-packs", () => {
  const actual = jest.requireActual<typeof SectorPacks>("@qticaret/sector-packs")
  const refuse = () => {
    throw new actual.SectorPackError("bicak/presets/x/layout.json home.0: secret content")
  }
  return {
    ...actual,
    // The packs are read together: one refused fails them all
    sectorPack: refuse,
    readPack: (_dir: string, code: string) =>
      code === "bicak" ? refuse() : { presets: [preset(code, `${code}-1`)] },
  }
})
jest.mock("node:fs", () => ({
  ...jest.requireActual<typeof Fs>("node:fs"),
  existsSync: () => true,
}))
jest.mock("../../../../workflows/storefront/layout-row", () => ({
  layoutRow: () => Promise.resolve(null),
}))

const container = {
  resolve: () => ({
    listSectorPackApplications: () => Promise.resolve([{ pack: "bicak" }, { pack: "kahve" }]),
  }),
} as unknown as MedusaContainer

describe("the preset gallery (adr/0063 §7)", () => {
  it("lists the other packs' presets past a pack its loader refuses, logging only its code", async () => {
    const error = jest.spyOn(logger, "error").mockImplementation(() => undefined)
    try {
      const gallery = await presetGallery(container)
      expect(gallery.map((each) => `${each.pack}/${each.code}`)).toEqual([
        "general/general-1",
        "kahve/kahve-1",
      ])
      expect(error).toHaveBeenCalledWith({
        event: "storefront_preset.pack_unreadable",
        pack: "bicak",
      })
      expect(JSON.stringify(error.mock.calls)).not.toMatch(/secret/)
    } finally {
      error.mockRestore()
    }
  })
})
