import { describe, expect, it } from "vitest"
import { i18next as i18n } from "@/lib/i18n"
import { outcomeLines } from "./outcome"
import type { CreateOutcome } from "./outcome"

const words = (outcome: CreateOutcome) => {
  const { keys, warning } = outcomeLines(outcome)
  return { text: keys.map((key) => i18n.t(key)).join(" "), warning }
}

describe("what opening a wholesaler did, in words", () => {
  it("an address with an account: active at once, the notice sent, the tax details written", () => {
    expect(
      words({ status: "active", message: "sent", billing: "written", taxTyped: true })
    ).toEqual({
      text:
        "Toptancı hemen etkinleşti: bu e-postayla açılmış bir müşteri hesabı vardı. " +
        '"Toptan hesabınız açıldı" e-postası gönderildi. ' +
        "Vergi bilgileri müşterinin fatura bilgilerine yazıldı.",
      warning: false,
    })
    expect(
      words({ status: "active", message: "sent", billing: "kept", taxTyped: true }).text
    ).toContain("Müşterinin kayıtlı fatura bilgileri vardı; değiştirilmedi.")
  })

  it("a new address: invited, the tax details not kept, nothing said of tax when none was typed", () => {
    expect(words({ status: "pending", message: "sent", billing: "none", taxTyped: true })).toEqual({
      text:
        "Davet e-postası gönderildi. Toptancı bu adresle hesap açınca etkinleşir; davet 90 gün geçerlidir. " +
        "Vergi bilgileri saklanmadı; toptancı hesabını açınca vitrinde kendisi girer.",
      warning: false,
    })
    expect(
      words({ status: "pending", message: "sent", billing: "none", taxTyped: false }).text
    ).not.toContain("Vergi")
  })

  it("an invitation that did not go is a warning pointing at the resend", () => {
    expect(
      words({ status: "pending", message: "not_sent", billing: "none", taxTyped: false })
    ).toEqual({
      text: 'Toptancı kaydı açıldı ama davet e-postası gönderilemedi. "Daveti yeniden gönder" ile tekrar deneyin.',
      warning: true,
    })
  })
})
