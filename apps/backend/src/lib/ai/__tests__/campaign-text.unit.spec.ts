import { composeSms, smsLength } from "../../campaigns/sms"
import { campaignEmailOf, campaignSmsOf, figuresOf, isCampaignAllowed } from "../campaign-text"
import type { CampaignAllowed } from "../campaign-text"
import { fakeCampaignAnswer } from "../connectors/fake-campaign"
import { CAMPAIGN_SUBJECT_MAX_LENGTH } from "../registry/campaign-tasks"

/**
 * A bulk message's words (adr/0074 §5 madde 6) read against their schema
 * and the shared gate: no markup, link, person, token or figure the data
 * does not hold; an SMS counted with its end as the send counts it.
 */

const EMAIL: CampaignAllowed = { kind: "campaign", numbers: ["20"], sms: null }
const SMS: CampaignAllowed = {
  kind: "campaign",
  numbers: [],
  sms: { shop: "Atölye", opt_out: "Ret için RET yazıp 4609'a gönderin." },
}

const BODY = [
  "Kış koleksiyonumuz raflarda; yün atkılar ve kalın çoraplar bu hafta geldi.",
  "Her parçayı soğuk günlerde rahat etmeniz için seçtik. Sizi mağazamıza bekliyoruz, seçkiyi birlikte keşfedelim.",
]

const email = (fields: Record<string, unknown>) =>
  JSON.stringify({
    subjects: ["Kış seçkisi geldi", "Yün atkılar raflarda", "Soğuk günlere hazır mısınız?"],
    preheader: "Yeni gelenlere göz atın",
    paragraphs: BODY,
    ...fields,
  })

describe("an e-mail's answer", () => {
  it("takes three subjects, a preview line and the body, each one plain line", () => {
    const result = campaignEmailOf(email({}), EMAIL)
    expect(result).toEqual({
      email: {
        subjects: ["Kış seçkisi geldi", "Yün atkılar raflarda", "Soğuk günlere hazır mısınız?"],
        preheader: "Yeni gelenlere göz atın",
        paragraphs: BODY,
      },
    })
  })

  it("drops a subject that fails or repeats, keeps the rest", () => {
    const result = campaignEmailOf(
      email({
        subjects: [
          "Kış seçkisi geldi",
          "kış seçkisi geldi!",
          "Tüm ürünlerde %50 indirim",
          "Ayrıntı: https://ornek.com",
          "Merhaba {ad}",
          "Kışa özel %20 indirim",
        ],
      }),
      EMAIL
    )
    expect("email" in result && result.email.subjects).toEqual([
      "Kış seçkisi geldi",
      "Kışa özel %20 indirim",
    ])
  })

  it("refuses when no subject passes", () => {
    expect(campaignEmailOf(email({ subjects: ["%30 indirim"] }), EMAIL)).toEqual({
      problems: ["subject.figure"],
    })
    expect(
      campaignEmailOf(
        email({ subjects: ["<b>Yeni</b> gelenler", "x".repeat(CAMPAIGN_SUBJECT_MAX_LENGTH + 1)] }),
        EMAIL
      )
    ).toEqual({ problems: ["subject.markup", "subject.length"] })
  })

  it("refuses the whole answer when one paragraph fails: no hole in a message", () => {
    const result = campaignEmailOf(
      email({ paragraphs: [...BODY, "Kargo 49 TL yerine bedava."] }),
      EMAIL
    )
    expect(result).toEqual({ problems: ["body.figure"] })
    expect(
      campaignEmailOf(email({ paragraphs: ["Bize ayse@example.com adresinden yazın."] }), EMAIL)
    ).toMatchObject({ problems: expect.arrayContaining(["body.personal_data"]) as unknown })
  })

  it("holds the body's words between its bounds", () => {
    expect(campaignEmailOf(email({ paragraphs: ["Yeni ürünler geldi."] }), EMAIL)).toEqual({
      problems: ["body.words"],
    })
    expect(campaignEmailOf(email({ paragraphs: [] }), EMAIL)).toEqual({ problems: ["body.empty"] })
  })

  it("leaves out a preview line that fails, keeps the rest", () => {
    const result = campaignEmailOf(email({ preheader: "Bugün %70 indirim" }), EMAIL)
    expect("email" in result && result.email.preheader).toBeNull()
  })

  it("refuses another shape, another key or no JSON at all", () => {
    expect(campaignEmailOf("Konu: Kış seçkisi", EMAIL)).toEqual({ problems: ["format"] })
    expect(campaignEmailOf(email({ html: "<p>x</p>" }), EMAIL)).toEqual({ problems: ["format"] })
    expect(campaignEmailOf(JSON.stringify({ subjects: "tek" }), EMAIL)).toEqual({
      problems: ["format"],
    })
  })
})

describe("a text's answer", () => {
  const texts = (list: unknown[]) => JSON.stringify({ texts: list })

  it("takes the texts that fit one SMS with the shop's name and opt-out line", () => {
    const short = "Yeni kış seçkimiz geldi, mağazamıza bekleriz."
    // Turkish letters take two septets: this one fits as written but not with its end
    const long = `${"ş".repeat(56)} geldi.`
    const result = campaignSmsOf(texts([short, long, "Hemen gel: https://ornek.com"]), SMS)
    expect(result).toEqual({ texts: [short] })
    const end = SMS.sms ?? { shop: "", opt_out: "" }
    expect(smsLength(composeSms(short, end.shop, end.opt_out)).parts).toBe(1)
  })

  it("refuses a text outside the GSM table that the count then sends as UCS-2", () => {
    expect(campaignSmsOf(texts([`Yeni ürünler geldi ${"â".repeat(40)}`]), SMS)).toEqual({
      problems: ["sms_length"],
    })
  })

  it("refuses when none passes, with what was wrong", () => {
    expect(campaignSmsOf(texts(["Bugün %40 indirim"]), SMS)).toEqual({ problems: ["figure"] })
    expect(campaignSmsOf(texts([]), SMS)).toEqual({ problems: ["empty"] })
    expect(campaignSmsOf(texts([3]), SMS)).toEqual({ problems: ["format"] })
  })
})

describe("the figures a text may write", () => {
  it("are those the data holds, as written", () => {
    expect(figuresOf(["Kasım %20 indirim", "KOD25 ile", null, "1.250 puan"])).toEqual([
      "20",
      "25",
      "1.250",
    ])
  })

  it("tells a campaign's limits from another task's lists", () => {
    expect(isCampaignAllowed(EMAIL)).toBe(true)
    expect(isCampaignAllowed({ kind: "product_faq", published: [] })).toBe(false)
  })
})

describe("the fake service's campaign words", () => {
  it("pass the gate, so the core's tests run on them", () => {
    const data = (fields: Record<string, string>) => JSON.stringify({ data: fields })
    const mail = fakeCampaignAnswer(data({ campaign: "Kış seçkisi", shop: "Atölye" })) ?? ""
    expect(campaignEmailOf(mail, { kind: "campaign", numbers: [], sms: null })).toHaveProperty(
      "email"
    )
    const text = fakeCampaignAnswer(data({ campaign: "Kış seçkisi", sms_max_chars: "80" })) ?? ""
    expect(campaignSmsOf(text, SMS)).toHaveProperty("texts")
    expect(fakeCampaignAnswer(data({ name: "Termos" }))).toBeNull()
  })
})
