import type * as Fs from "node:fs"
import type { MedusaContainer } from "@medusajs/framework/types"
import type * as SectorPacks from "@qticaret/sector-packs"
import { logger } from "../../../../lib/logging"
import { presetGallery } from "../read"

const preset = (pack: string, code: string, more: Record<string, unknown> = {}) => ({
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
  family: null,
  swatch: null,
  layout: {},
  theme_settings: {},
  ...more,
})

// Two colours of one look and a plain one (adr/0064 Ek 2026-11-17 §2.1)
const KAHVE = [
  preset("kahve", "kahve-1", {
    family: "kahve-1",
    swatch: "Antrasit ve kırmızı",
    version: 3,
    preview: "preview.webp",
    layout: {
      header: [{ id: "duyuru1", type: "announcement" }],
      home: [{ id: "yazilar1", type: "posts" }],
    },
    theme_settings: {
      colors: { primary: "#111111", accent: null, background: "warm" },
      typography: { heading: "fraunces", body: "inter" },
    },
  }),
  preset("kahve", "kahve-2", { family: "kahve-1", swatch: "Lacivert ve çelik" }),
]

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
      code === "bicak"
        ? refuse()
        : {
            name: `${code} paketi`,
            presets: code === "kahve" ? KAHVE : [preset(code, `${code}-1`)],
          },
  }
})
jest.mock("node:fs", () => ({
  ...jest.requireActual<typeof Fs>("node:fs"),
  existsSync: () => true,
  // The packs this build has: the shop's own and another sector's (`baska`)
  readdirSync: () =>
    ["kahve", "general", "baska", ".gizli"].map((name) => ({ name, isDirectory: () => true })),
}))
let mockRow: unknown = null
jest.mock("../../../../workflows/storefront/layout-row", () => ({
  layoutRow: () => Promise.resolve(mockRow),
}))

const container = {
  resolve: () => ({
    listSectorPackApplications: () => Promise.resolve([{ pack: "bicak" }, { pack: "kahve" }]),
  }),
} as unknown as MedusaContainer

const quiet = () => jest.spyOn(logger, "error").mockImplementation(() => undefined)

describe("the preset gallery (adr/0063 §7)", () => {
  afterEach(() => {
    mockRow = null
  })

  it("lists the other packs' presets past a pack its loader refuses, logging only its code", async () => {
    const error = quiet()
    try {
      const gallery = await presetGallery(container)
      expect(gallery.map((each) => `${each.pack}/${each.code}`)).toEqual([
        "general/general-1",
        "kahve/kahve-1",
        "kahve/kahve-2",
        "baska/baska-1",
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

  it("lists the other sectors' looks after the shop's own, each with its sector (owner, 2026-11-28)", async () => {
    const error = quiet()
    try {
      const gallery = await presetGallery(container)
      const byCode = Object.fromEntries(gallery.map((each) => [each.code, each]))
      expect(byCode["general-1"]).toMatchObject({
        own: true,
        sector: { code: "general", name: "general paketi" },
      })
      expect(byCode["kahve-1"]).toMatchObject({
        own: true,
        sector: { code: "kahve", name: "kahve paketi" },
      })
      expect(byCode["baska-1"]).toMatchObject({
        own: false,
        sector: { code: "baska", name: "baska paketi" },
        preview_url: null,
      })
      // A folder no pack code names is never read as a pack
      expect(gallery.some((each) => each.pack.startsWith("."))).toBe(false)
    } finally {
      error.mockRestore()
    }
  })

  it("gives each card its family, colour, sketch, groups and picture (adr/0064 Ek 2026-11-17)", async () => {
    const error = quiet()
    try {
      const [plain, first, second] = await presetGallery(container)
      expect(plain).toMatchObject({
        family: "general-1",
        swatch: null,
        has_header: false,
        has_footer: false,
        preview_url: null,
      })
      expect(first).toMatchObject({
        family: "kahve-1",
        swatch: "Antrasit ve kırmızı",
        has_header: true,
        has_footer: false,
        has_preview: true,
        preview_url: "/admin/storefront-presets/kahve/kahve-1/preview?v=3",
        summary: {
          source: "preset",
          source_name: "kahve-1",
          preset: { pack: "kahve", code: "kahve-1", version: 3 },
          colors: { primary: "#111111", accent: null, background: "warm" },
          fonts: { heading: "fraunces", body: "inter" },
          sections: { header: 1, home: 1, footer: 0, product: 0, category: 0 },
          home_types: ["posts"],
          edited: false,
          reason: null,
        },
      })
      expect(second).toMatchObject({ family: "kahve-1", swatch: "Lacivert ve çelik" })
      // The card never carries a look's document
      expect(first).not.toHaveProperty("layout")
      expect(first).not.toHaveProperty("theme_settings")
    } finally {
      error.mockRestore()
    }
  })

  it("names the preset in the draft and live, unless a saved look was given since", async () => {
    const error = quiet()
    const label = { pack: "kahve", code: "kahve-1", version: 2 }
    try {
      mockRow = {
        draft: { settings: { preset: label, design: { id: null, digest: "a".repeat(64) } } },
        published: { settings: { preset: label } },
      }
      const kahve = (await presetGallery(container)).find((each) => each.code === "kahve-1")
      expect(kahve).toMatchObject({ in_draft: 2, live: 2 })

      mockRow = {
        draft: { settings: { preset: label, design: { id: "sfd_01A", digest: "a".repeat(64) } } },
        published: { settings: { preset: label } },
      }
      const after = (await presetGallery(container)).find((each) => each.code === "kahve-1")
      expect(after).toMatchObject({ in_draft: null, live: 2 })
    } finally {
      error.mockRestore()
    }
  })

  it("lists the cards when the draft and live name a look this build no longer has", async () => {
    // A shop given general/grafit before it was removed (owner, 2026-11-17)
    const error = quiet()
    const gone = { pack: "general", code: "grafit", version: 1 }
    try {
      mockRow = { draft: { settings: { preset: gone } }, published: { settings: { preset: gone } } }
      const gallery = await presetGallery(container)
      expect(gallery.map((each) => `${each.pack}/${each.code}`)).toEqual([
        "general/general-1",
        "kahve/kahve-1",
        "kahve/kahve-2",
        "baska/baska-1",
      ])
      expect(gallery.every((each) => each.in_draft === null && each.live === null)).toBe(true)
    } finally {
      error.mockRestore()
    }
  })
})
