import { describe, expect, it } from "vitest"
import { looksLikeLegalText } from "./legal-title"

describe("looksLikeLegalText", () => {
  it("knows the legal texts, with or without Turkish letters", () => {
    for (const title of [
      "Mesafeli Satış Sözleşmesi",
      "KVKK Aydınlatma Metni",
      "Çerez Politikası",
      "cerez politikasi",
      "İade ve Değişim Politikası",
      "Kargo ve İade",
      "Gizlilik Politikası",
      "Ön Bilgilendirme Formu",
      "TOPTAN SATIŞ SÖZLEŞMESİ",
    ]) {
      expect(looksLikeLegalText(title)).toBe(true)
    }
  })

  it("leaves the shop's own pages alone", () => {
    for (const title of ["Hakkımızda", "Sık Sorulan Sorular", "İletişim", "Toptan Satış"]) {
      expect(looksLikeLegalText(title)).toBe(false)
    }
  })
})
