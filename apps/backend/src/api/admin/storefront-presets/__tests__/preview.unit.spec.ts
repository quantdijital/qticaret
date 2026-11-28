import { join } from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import type * as SectorPacks from "@qticaret/sector-packs"
import { PRESET_LIMITS, SectorPackError } from "@qticaret/sector-packs"
import { presetPreview } from "../preview"

const mockPreset = jest.fn()
const mockStat = jest.fn()
const mockRead = jest.fn()

jest.mock("@qticaret/sector-packs", () => {
  const actual = jest.requireActual<typeof SectorPacks>("@qticaret/sector-packs")
  return {
    ...actual,
    storefrontPreset: (...args: unknown[]): unknown => mockPreset(...args),
  }
})
jest.mock("node:fs/promises", () => ({
  lstat: (...args: unknown[]): unknown => mockStat(...args),
  readFile: (...args: unknown[]): unknown => mockRead(...args),
}))

const DIR = "/packs/kahve/presets/kahve-1"
const IMAGE = Buffer.from("RIFF....WEBP")

function containerWith(applied: string[]) {
  const list = jest.fn((filter: { pack: string }) =>
    Promise.resolve(applied.includes(filter.pack) ? [{ id: "spa_1" }] : [])
  )
  const container = {
    resolve: () => ({ listSectorPackApplications: list }),
  } as unknown as MedusaContainer
  return { container, list }
}

const file = (size: number, isFile = true) => ({ size, isFile: () => isFile })

describe("a ready-made look's picture (adr/0063 §7)", () => {
  beforeEach(() => {
    mockPreset.mockReset().mockReturnValue({ dir: DIR, preview: "preview.webp" })
    mockStat.mockReset().mockResolvedValue(file(1000))
    mockRead.mockReset().mockResolvedValue(IMAGE)
  })

  it("reads only the loader's own file beside the look, by the fixed name", async () => {
    const { container, list } = containerWith(["kahve"])
    await expect(presetPreview(container, "kahve", "kahve-1")).resolves.toBe(IMAGE)
    expect(mockPreset).toHaveBeenCalledWith("kahve", "kahve-1", undefined)
    expect(mockStat).toHaveBeenCalledWith(join(DIR, "preview.webp"))
    expect(mockRead).toHaveBeenCalledWith(join(DIR, "preview.webp"))
    expect(list).not.toHaveBeenCalled()
  })

  it("serves general's looks without asking whether the pack is applied", async () => {
    const { container, list } = containerWith([])
    await expect(presetPreview(container, "general", "vitrin")).resolves.toBe(IMAGE)
    expect(list).not.toHaveBeenCalled()
  })

  it("serves another sector's look too: the gallery lists every pack (owner, 2026-11-28)", async () => {
    const { container, list } = containerWith(["baska"])
    await expect(presetPreview(container, "kahve", "kahve-1")).resolves.toBe(IMAGE)
    expect(list).not.toHaveBeenCalled()
  })

  it("has none for an unknown look, one the loader refuses, or one without a picture", async () => {
    const { container } = containerWith(["kahve"])
    mockPreset.mockReturnValueOnce(null)
    await expect(presetPreview(container, "kahve", "yok")).resolves.toBeNull()
    mockPreset.mockImplementationOnce(() => {
      throw new SectorPackError("kahve/presets/x: unreadable")
    })
    await expect(presetPreview(container, "kahve", "x")).resolves.toBeNull()
    mockPreset.mockReturnValueOnce({ dir: DIR, preview: null })
    await expect(presetPreview(container, "kahve", "kahve-1")).resolves.toBeNull()
    expect(mockRead).not.toHaveBeenCalled()
  })

  it("lets an unexpected failure through", async () => {
    const { container } = containerWith(["kahve"])
    mockPreset.mockImplementationOnce(() => {
      throw new Error("disk")
    })
    await expect(presetPreview(container, "kahve", "kahve-1")).rejects.toThrow("disk")
  })

  it("has none for a file gone, not a file, or larger than the loader allows", async () => {
    const { container } = containerWith(["kahve"])
    mockStat.mockRejectedValueOnce(new Error("ENOENT"))
    await expect(presetPreview(container, "kahve", "kahve-1")).resolves.toBeNull()
    mockStat.mockResolvedValueOnce(file(1000, false))
    await expect(presetPreview(container, "kahve", "kahve-1")).resolves.toBeNull()
    mockStat.mockResolvedValueOnce(file(PRESET_LIMITS.previewBytes + 1))
    await expect(presetPreview(container, "kahve", "kahve-1")).resolves.toBeNull()
    expect(mockRead).not.toHaveBeenCalled()
  })

  it("has none for a symbolic link, never following it", async () => {
    const { container } = containerWith(["kahve"])
    // lstat describes the link itself: not a file, whatever it points at
    mockStat.mockResolvedValueOnce({ size: 10, isFile: () => false, isSymbolicLink: () => true })
    await expect(presetPreview(container, "kahve", "kahve-1")).resolves.toBeNull()
    expect(mockRead).not.toHaveBeenCalled()
  })
})
