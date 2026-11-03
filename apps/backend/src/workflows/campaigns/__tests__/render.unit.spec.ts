import { MESSAGE_TEMPLATES } from "../../../lib/messaging/templates"
import type { Brand } from "../../../lib/messaging/templates"
import { recipientOfToken } from "../../../lib/messaging/unsubscribe"
import { personalise, renderCampaign } from "../prepare"
import type { PreparedCampaign } from "../prepare"
import { PREVIEW_UNSUBSCRIBE_TOKEN } from "../preview"

const brand: Brand = {
  shopName: "Örnek Mağaza",
  logoUrl: null,
  color: "#111827",
  contactEmail: "destek@magaza.example",
  contactPhone: null,
  storefrontUrl: "https://magaza.example",
}

const prepared: PreparedCampaign = {
  subject: "{ad}, kış indirimi başladı",
  preheader: "Seçili ürünlerde %20",
  blocks: [{ kind: "rich", runs: [{ text: "Merhaba {ad}" }] }],
  legal: "Örnek Ticaret Ltd. Şti.",
  sms: "Kış indirimi başladı. Örnek Mağaza. Ret için RET yazın.",
}

const LEAVE = `https://magaza.example/abonelik/cik?t=${PREVIEW_UNSUBSCRIBE_TOKEN}`

describe("a campaign rendered for one recipient (adr/0050 §10)", () => {
  it("is what the template makes for every send, the way out in its footer", () => {
    const vars = personalise(prepared, "Selin")
    const rendered = renderCampaign("email", vars, brand, LEAVE)
    expect(rendered).toEqual({
      channel: "email",
      email: MESSAGE_TEMPLATES["marketing.campaign"].email?.(vars, brand, {
        unsubscribeUrl: LEAVE,
      }),
    })
    if (rendered.channel !== "email") {
      throw new Error("expected an e-mail")
    }
    expect(rendered.email.subject).toBe("Selin, kış indirimi başladı")
    expect(rendered.email.html).toContain("Merhaba Selin")
    expect(rendered.email.html).toContain("Örnek Ticaret Ltd. Şti.")
    expect(rendered.email.html).toContain(LEAVE)
  })

  it("gives a text as it goes, its opt-out line written in", () => {
    const rendered = renderCampaign("sms", personalise(prepared, null), brand, null)
    expect(rendered).toEqual({ channel: "sms", text: prepared.sms })
  })

  it("marks only a test send", () => {
    const rendered = renderCampaign("email", personalise(prepared, "Selin", true), brand, LEAVE)
    expect(rendered.channel === "email" && rendered.email.subject).toBe(
      "[Deneme] Selin, kış indirimi başladı"
    )
  })

  it("shows a way out no unsubscribe link accepts", () => {
    expect(recipientOfToken(PREVIEW_UNSUBSCRIBE_TOKEN, Buffer.alloc(32, 7))).toBeNull()
  })
})
