import { describe, expect, it } from "vitest"
import { i18next as i18n } from "@/lib/i18n"
import { outcomeLines } from "./outcome"
import type { CreateOutcome } from "./outcome"

const words = (outcome: CreateOutcome) => {
  const { keys, warning } = outcomeLines(outcome)
  return { text: keys.map((key) => i18n.t(key)).join(" "), warning }
}

describe("what opening a wholesaler did, in words (Ek 2026-11-15 (2))", () => {
  it("case 1: a new sign-in with staff's password, the tax details written", () => {
    expect(words({ password: "set", billing: "written", taxTyped: true })).toEqual({
      text:
        "Toptancı hesabı açıldı ve etkin. Şifreyi toptancıya iletin; ilk girişte değiştirmesini önerin. " +
        "Vergi bilgileri müşterinin fatura bilgilerine yazıldı.",
      warning: false,
    })
  })

  it("case 2: a proven customer keeps their own password; nothing said of tax when none typed", () => {
    expect(words({ password: "kept", billing: "none", taxTyped: false })).toEqual({
      text: "Bu e-postayla doğrulanmış bir müşteri hesabı vardı; toptancı kendi şifresiyle giriş yapar, yazdığınız şifre kullanılmadı.",
      warning: false,
    })
    expect(words({ password: "kept", billing: "kept", taxTyped: true }).text).toContain(
      "Müşterinin kayıtlı fatura bilgileri vardı; değiştirilmedi."
    )
  })

  it("case 3: an unconfirmed sign-up taken over is said plainly, as a warning", () => {
    expect(words({ password: "replaced", billing: "written", taxTyped: false })).toEqual({
      text: "Adresteki doğrulanmamış hesap devralındı: şifresi değişti, açık oturumları kapandı ve açık sepetleri kaldırıldı. Şifreyi toptancıya iletin.",
      warning: true,
    })
  })
})
