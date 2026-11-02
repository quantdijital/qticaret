import type { StoreBrand } from "@qticaret/types"
import { describe, expect, it } from "vitest"
import { brandGroups, letterOf } from "../brands"

const brand = (id: string, name: string, logo: string | null = null): StoreBrand => ({
  id,
  name,
  handle: id,
  logo_url: logo,
})

describe("the brand index (/markalar)", () => {
  it("files a name under its first letter as Turkish writes it", () => {
    expect(letterOf("ırmak")).toBe("I")
    expect(letterOf("istanbul")).toBe("İ")
    expect(letterOf("çelik")).toBe("Ç")
    expect(letterOf("  Şahin")).toBe("Ş")
    expect(letterOf("Ölçü")).toBe("Ö")
    // Other languages' marks fold to the letter
    expect(letterOf("Âlâ")).toBe("A")
    expect(letterOf("Éclat")).toBe("E")
    // A decomposed Ç is still Ç
    expect(letterOf("Çini")).toBe("Ç")
    expect(letterOf("3M")).toBeNull()
    expect(letterOf("&Co")).toBeNull()
    expect(letterOf("")).toBeNull()
  })

  it("groups the brands in the Turkish alphabet's order, the rest last, each sorted", () => {
    const brands = [
      brand("b1", "Zwilling"),
      brand("b2", "istanbul Bıçak"),
      brand("b3", "Ilgaz"),
      brand("b4", "3 Claveles"),
      brand("b5", "Çakır", "https://cdn.example/cakir.png"),
      brand("b6", "Cem"),
      brand("b7", "ışık"),
      brand("b8", "Arcos"),
      brand("b9", "Yok"),
    ]
    const paths = Object.fromEntries(
      brands.filter((each) => each.id !== "b9").map((each) => [each.id, `/marka/${each.id}`])
    )
    const groups = brandGroups(brands, paths, "Diğer")
    expect(groups.map((group) => [group.letter, group.brands.map((each) => each.label)])).toEqual([
      ["A", ["Arcos"]],
      ["C", ["Cem"]],
      ["Ç", ["Çakır"]],
      ["I", ["Ilgaz", "ışık"]],
      ["İ", ["istanbul Bıçak"]],
      ["Z", ["Zwilling"]],
      ["Diğer", ["3 Claveles"]],
    ])
    expect(groups.map((group) => group.anchor)).toEqual([
      "harf-1",
      "harf-2",
      "harf-3",
      "harf-4",
      "harf-5",
      "harf-6",
      "harf-7",
    ])
    // The name says it all: the logo beside it has no alt text of its own
    expect(groups[2]?.brands[0]).toEqual({
      label: "Çakır",
      path: "/marka/b5",
      logo: {
        src: "https://cdn.example/cakir.png",
        alt: "",
        width: null,
        height: null,
        sources: { avif: null, webp: null },
      },
    })
    expect(groups[0]?.brands[0]?.logo).toBeNull()
  })

  it("is empty without a brand at a live path", () => {
    expect(brandGroups([brand("b1", "Arcos")], {}, "Diğer")).toEqual([])
  })
})
