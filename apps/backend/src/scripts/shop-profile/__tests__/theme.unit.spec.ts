import type { MedusaContainer } from "@medusajs/framework/types"
import { carryProfileTheme } from "../theme"
import type { LoadedProfile } from "../profile"

const row = jest.fn()
const save = jest.fn()
const THEME = { settings_version: 2, theme: "atolye", radius: "sharp" }

jest.mock("../../../workflows/storefront/layout-row", () => ({
  layoutRow: () => row() as Promise<unknown>,
}))
jest.mock("../../../workflows/storefront/layout-shared", () => ({
  legacySettings: () => Promise.resolve({ theme: THEME }),
}))
jest.mock("../../../workflows/storefront/layout", () => ({
  saveLayoutDraftWorkflow: () => ({ run: save }),
}))
jest.mock("../../../lib/storefront/layout", () => ({
  readStoredLayout: (stored: { settings: object }) => stored,
}))
jest.mock("../../../lib/storefront/layout-settings", () => ({
  storedSettings: (doc: { settings?: { theme?: unknown } } | null) => ({
    theme: doc?.settings?.theme ?? null,
  }),
}))

const container = {} as MedusaContainer
const profile = (sections: object) => ({ profile: { sections } }) as unknown as LoadedProfile

beforeEach(() => {
  jest.clearAllMocks()
  save.mockResolvedValue({})
})

describe("a shop profile's theme and the design (adr/0063 §3)", () => {
  it("writes the saved theme into the draft when the design holds a theme", async () => {
    row.mockResolvedValue({
      draft: { home: [], settings: { theme: { radius: "soft" }, menus: null } },
      published: { settings: { theme: { radius: "soft" } } },
    })
    await expect(
      carryProfileTheme(container, profile({ theme: { radius: "sharp" } }))
    ).resolves.toBe(true)
    expect(save).toHaveBeenCalledWith({
      input: { home: [], settings: { theme: THEME, menus: null } },
    })
  })

  it("writes it into a draft that holds no theme of its own while the live design has one", async () => {
    row.mockResolvedValue({
      draft: { home: [], settings: { theme: null, menus: null } },
      published: { settings: { theme: { radius: "soft" } } },
    })
    await expect(carryProfileTheme(container, profile({ theme: {} }))).resolves.toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it("keeps the owner's unpublished theme change in the draft", async () => {
    row.mockResolvedValue({
      draft: { home: [], settings: { theme: { radius: "pill" }, menus: null } },
      published: { settings: { theme: { radius: "soft" } } },
    })
    await expect(carryProfileTheme(container, profile({ theme: {} }))).resolves.toBe(false)
    // A theme drafted in a design never published is a change too
    row.mockResolvedValue({
      draft: { home: [], settings: { theme: { radius: "pill" }, menus: null } },
      published: null,
    })
    await expect(carryProfileTheme(container, profile({ theme: {} }))).resolves.toBe(false)
    expect(save).not.toHaveBeenCalled()
  })

  it("leaves the design alone without a theme in the profile or in the design", async () => {
    row.mockResolvedValue({ draft: { settings: { theme: null } }, published: null })
    await expect(carryProfileTheme(container, profile({ theme: {} }))).resolves.toBe(false)
    row.mockResolvedValue({ draft: { settings: { theme: { radius: "soft" } } }, published: null })
    await expect(carryProfileTheme(container, profile({ store: {} }))).resolves.toBe(false)
    row.mockResolvedValue(null)
    await expect(carryProfileTheme(container, profile({ theme: {} }))).resolves.toBe(false)
    expect(save).not.toHaveBeenCalled()
  })
})
