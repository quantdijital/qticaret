import { describe, expect, it } from "vitest"
import { DEFAULT_VARIANT_KEY } from "./schema"
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
    const rows = syncVariants(
      [],
      [
        {
          key: DEFAULT_VARIANT_KEY,
          title: "",
          options: {},
          price: "89",
          stock: "3",
          sku: "",
          ean: "",
        },
      ],
      false
    )
    expect(rows).toEqual([
      {
        key: DEFAULT_VARIANT_KEY,
        title: "",
        options: {},
        price: "89",
        stock: "3",
        sku: "",
        ean: "",
      },
    ])
  })
})
