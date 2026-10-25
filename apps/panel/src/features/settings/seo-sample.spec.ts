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

  it("drops an empty token with its joiner and folds a doubled stop, as the server does", () => {
    expect(renderSample("{ürün_adı} | {marka} | {mağaza}", "Demo", { ürün_adı: "Kupa" })).toBe(
      "Kupa | Demo"
    )
    expect(
      renderSample("{kısa_açıklama}. {fiyat_cümlesi}", "Demo", { kısa_açıklama: "Seramik kupa." })
    ).toBe("Seramik kupa.")
    expect(renderSample("{ürün_adı}...", "Demo", { ürün_adı: "Kupa" })).toBe("Kupa...")
    expect(renderSample("{constructor} | {ürün_adı}", "Demo", { ürün_adı: "Kupa" })).toBe("Kupa")
  })
})
