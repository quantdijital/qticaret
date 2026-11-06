import { describe, expect, it } from "vitest"
import { BLANK_VARIANT, DEFAULT_VARIANT_KEY } from "./schema"
import { combinations, syncVariants } from "./variants"

const size = { title: "Beden", values: ["S", "M"] }
const colour = { title: "Renk", values: ["Siyah", "Beyaz"] }

describe("combinations", () => {
  it("crosses every option's values in order", () => {
    expect(combinations([size, colour])).toEqual([
      { Beden: "S", Renk: "Siyah" },
      { Beden: "S", Renk: "Beyaz" },
      { Beden: "M", Renk: "Siyah" },
      { Beden: "M", Renk: "Beyaz" },
    ])
  })
})

describe("syncVariants", () => {
  it("keeps what was typed for a combination that stays", () => {
    const first = syncVariants([size], [], true)
    const typed = first.map((row) => (row.key === "M" ? { ...row, price: "399", stock: "5" } : row))
    const next = syncVariants([size, colour], syncVariants([size], typed, true), true)

    expect(next.map((row) => row.key)).toEqual(["S / Siyah", "S / Beyaz", "M / Siyah", "M / Beyaz"])
    // A new option makes new combinations; the old row's values stay with its key only
    expect(syncVariants([size], typed, true).find((row) => row.key === "M")?.price).toBe("399")
  })

  it("falls back to one default row without options", () => {
    const row = { ...BLANK_VARIANT, key: DEFAULT_VARIANT_KEY, title: "", options: {} }
    const rows = syncVariants([], [{ ...row, price: "89", stock: "3" }], false)
    expect(rows).toEqual([{ ...row, price: "89", stock: "3" }])
  })

  it("keeps a combination's cost, codes, parcel and pictures while it stays", () => {
    const typed = syncVariants([size], [], true).map((row) =>
      row.key === "M"
        ? { ...row, cost: "120", mpn: "BK-M", weight: "0,4", image_urls: ["https://x/m.jpg"] }
        : row
    )
    const kept = syncVariants([{ ...size, values: ["M", "L"] }], typed, true)
    expect(kept.find((row) => row.key === "M")).toMatchObject({
      cost: "120",
      mpn: "BK-M",
      weight: "0,4",
      image_urls: ["https://x/m.jpg"],
    })
    expect(kept.find((row) => row.key === "L")).toMatchObject({ cost: "", image_urls: [] })
  })

  it("leaves a combination's own pictures and parcel behind when the options go", () => {
    const typed = syncVariants([size], [], true).map((row) => ({
      ...row,
      price: "50",
      weight: "0,4",
      image_urls: ["https://x/s.jpg"],
    }))
    expect(syncVariants([], typed, false)).toEqual([
      { ...BLANK_VARIANT, key: DEFAULT_VARIANT_KEY, title: "", options: {}, price: "50" },
    ])
  })
})
