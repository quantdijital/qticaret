import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { emailLinkView, linkTokenOf, outcomePath } from "../email-links"
import type { EmailLinkKind } from "../email-links"

const UNSUBSCRIBE = `${"a".repeat(64)}.${"B".repeat(43)}`
const RANDOM = "Zx_9-".repeat(8) + "abc"

const view = (kind: EmailLinkKind, token: unknown, outcome?: unknown) =>
  emailLinkView(kind, { token, outcome }, t)

describe("emailLinkView (adr/0038 Ek 2026-11-02)", () => {
  it("asks first, the token in the form, never acting on the visit itself", () => {
    const page = view("unsubscribe", UNSUBSCRIBE)
    expect(page.title).toBe("Kampanya e-postalarından çıkın")
    expect(page.submit).toBe("Çıkışı onayla")
    expect(page.fields).toEqual([{ name: "token", value: UNSUBSCRIBE }])
    expect(view("consent", RANDOM).submit).toBe("Onayla")
    expect(view("stock_alert", RANDOM).fields).toEqual([{ name: "token", value: RANDOM }])
  })

  it("says a broken link is broken, with no button and no token carried", () => {
    for (const [kind, token] of [
      ["unsubscribe", RANDOM],
      ["unsubscribe", undefined],
      ["consent", "kisa"],
      ["consent", ["iki", "token"]],
      ["stock_alert", `${RANDOM}<script>`],
    ] as const) {
      const page = view(kind, token)
      expect(page.title).toBe("Bağlantı geçersiz")
      expect(page.submit).toBeNull()
      expect(page.fields).toEqual([])
    }
  })

  it("says what happened once the button was pressed, whatever token is still in the address", () => {
    expect(view("unsubscribe", UNSUBSCRIBE, "tamam")).toMatchObject({
      title: "Çıkışınız alındı",
      submit: null,
      fields: [],
    })
    expect(view("consent", undefined, "verildi").title).toBe("İzniniz kaydedildi")
    expect(view("consent", undefined, "geri-cekildi").title).toBe("İzniniz geri çekildi")
    expect(view("stock_alert", undefined, "tamam").title).toBe("Stok bildirimi açıldı")
    expect(view("stock_alert", undefined, "gecersiz").text).toMatch(/Ürün sayfasından/)
    expect(view("consent", undefined, "yogun").title).toBe("Çok fazla deneme")
    expect(view("unsubscribe", undefined, "hata").title).toBe("İşlem yapılamadı")
  })

  it("never says what its own link cannot do", () => {
    expect(view("unsubscribe", undefined, "verildi").title).toBe("Bağlantı geçersiz")
    expect(view("consent", RANDOM, "tamam").submit).toBe("Onayla")
    expect(view("stock_alert", undefined, "baska").title).toBe("Bağlantı geçersiz")
  })

  it("has every word it shows in tr.json", () => {
    const pages = (["unsubscribe", "consent", "stock_alert"] as const).flatMap((kind) => [
      view(kind, kind === "unsubscribe" ? UNSUBSCRIBE : RANDOM),
      ...["tamam", "verildi", "geri-cekildi", "gecersiz", "yogun", "hata"].map((outcome) =>
        view(kind, undefined, outcome)
      ),
    ])
    for (const page of pages) {
      for (const text of [page.title, page.text, page.submit ?? "", page.back.label]) {
        expect(text).not.toMatch(/^email_links\./)
      }
    }
  })
})

describe("linkTokenOf and outcomePath", () => {
  it("takes only the backend's token shapes", () => {
    expect(linkTokenOf("unsubscribe", UNSUBSCRIBE)).toBe(UNSUBSCRIBE)
    expect(linkTokenOf("unsubscribe", UNSUBSCRIBE.toUpperCase())).toBeNull()
    expect(linkTokenOf("consent", RANDOM)).toBe(RANDOM)
    expect(linkTokenOf("consent", "a".repeat(101))).toBeNull()
    expect(linkTokenOf("stock_alert", null)).toBeNull()
  })

  it("comes back to the page, the token out of the address", () => {
    expect(outcomePath("unsubscribe", "done")).toBe("/abonelik/cik?sonuc=tamam")
    expect(outcomePath("consent", "revoked")).toBe("/abonelik/onay?sonuc=geri-cekildi")
    expect(outcomePath("stock_alert", "busy")).toBe("/stok-bildirimi/onay?sonuc=yogun")
  })
})
