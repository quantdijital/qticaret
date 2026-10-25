import { describe, expect, it } from "vitest"
import { renderSample } from "./seo-sample"

const SAMPLES = { ürün_adı: "Keten Gömlek", marka: "Örnek Marka", kategori: "Giyim" }

describe("renderSample", () => {
  it("fills known tokens, the shop's name and tidies spaces", () => {
    expect(renderSample("{ürün_adı} | {marka} | {mağaza}", "Demo", SAMPLES)).toBe(
      "Keten Gömlek | Örnek Marka | Demo"
    )
  })

  it("drops unknown tokens instead of showing braces", () => {
    expect(renderSample("{bilinmeyen}  {kategori} Modelleri", "Demo", SAMPLES)).toBe(
      "Giyim Modelleri"
    )
  })
})
