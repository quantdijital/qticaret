import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { campaignInput, smsRoom } from "../../../workflows/ai/steps/campaign-input"
import { CAMPAIGNS_MODULE } from "../../../modules/campaigns"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { cardProductIds } from "../facts/campaign"
import { GUIDANCE_HEADING } from "../guidance"
import { RULES_HEADING, isCraftTask, isTaskOption, systemOf, takesGuidance } from "../instructions"
import { CAMPAIGN_EMAIL_TASK, CAMPAIGN_SMS_TASK } from "../registry/tasks"

jest.mock("../../../workflows/messaging/brand", () => ({
  brandOf: () => Promise.resolve({ shopName: "Atölye" }),
}))

/**
 * A bulk message's words read from the campaign alone (adr/0074 §5 madde 6):
 * its name and words, the names of the published storefront products it
 * shows; never its audience, a recipient or a count. The figures it holds
 * and an SMS's end stay on the server beside the prompt.
 */

const card = (id: string) => ({ type: "productCard", attrs: { id } })

const EMAIL_ROW = {
  id: "camp_1",
  name: "Kasım %20 indirim",
  channel: "email",
  subject: "Kasım fırsatları",
  preheader: null,
  body: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "KASIM20 koduyla alışverişte indirim.",
            marks: [{ type: "link", attrs: { href: "https://ornek.com/gizli-yol" } }],
          },
        ],
      },
      card("prod_shown"),
      card("prod_other_channel"),
      card("prod_draft"),
    ],
  },
  sms_text: null,
  // Never read: a reader that took them would show them in the data block
  audience: [{ kind: "segment", id: "seg_1" }],
  counts: { recipients: 1234 },
  created_by: "user_ayse",
}

function containerWith(row: Record<string, unknown>, optOut: string | null = "Ret için RET yaz.") {
  const selects: string[][] = []
  const productFilters: unknown[] = []
  const query = {
    graph: (request: { entity: string; filters?: unknown }) => {
      if (request.entity === "api_key") {
        return Promise.resolve({
          data: [{ id: "apk_1", revoked_at: null, sales_channels: [{ id: "sc_store" }] }],
        })
      }
      productFilters.push(request.filters)
      // The reader holds the status and the channel itself
      return Promise.resolve({
        data: [
          {
            id: "prod_shown",
            title: "Yün atkı",
            status: "published",
            sales_channels: [{ id: "sc_store" }],
          },
          {
            id: "prod_draft",
            title: "Taslak atkı",
            status: "draft",
            sales_channels: [{ id: "sc_store" }],
          },
          {
            id: "prod_other_channel",
            title: "Toptan atkı",
            status: "published",
            sales_channels: [{ id: "sc_b2b" }],
          },
        ],
      })
    },
  }
  const campaigns = {
    listBulkMessages: (_filters: unknown, config: { select: string[] }) => {
      selects.push(config.select)
      return Promise.resolve([row])
    },
  }
  const settings = {
    getSection: () => Promise.resolve({ sms_opt_out_text: optOut }),
  }
  const container = {
    resolve: (key: string): unknown => {
      if (key === CAMPAIGNS_MODULE) {
        return campaigns
      }
      if (key === PLATFORM_SETTINGS_MODULE) {
        return settings
      }
      if (key === ContainerRegistrationKeys.QUERY) {
        return query
      }
      throw new Error(`unexpected ${key}`)
    },
  }
  return { container, selects, productFilters }
}

const system = (task = CAMPAIGN_EMAIL_TASK) => systemOf(task, "discount", "campaign") ?? ""

describe("a bulk e-mail's data block", () => {
  it("holds its name, words and shown products, nothing of its audience", async () => {
    const { container, selects, productFilters } = containerWith(EMAIL_ROW)
    const input = await campaignInput(container, CAMPAIGN_EMAIL_TASK, system(), "camp_1")
    const data = JSON.parse(input.data) as { data: Record<string, string> }
    expect(data.data).toEqual({
      campaign: "Kasım %20 indirim",
      products: "Yün atkı",
      subject: "Kasım fırsatları",
      shop: "Atölye",
      body: "KASIM20 koduyla alışverişte indirim.",
    })
    expect(selects[0]).not.toEqual(expect.arrayContaining(["audience"]))
    expect(selects[0]?.join(" ")).not.toMatch(/audience|counts|created_by|sent_by|recipient/)
    expect(productFilters[0]).toEqual({
      id: expect.arrayContaining(["prod_shown", "prod_other_channel", "prod_draft"]) as unknown,
    })
    expect(input.data).not.toMatch(/seg_1|1234|user_ayse|gizli-yol|Toptan|Taslak/)
    expect(input.campaign).toEqual({ kind: "campaign", numbers: ["20"], sms: null })
  })

  it("names no product when the body shows no card", async () => {
    const { container } = containerWith({ ...EMAIL_ROW, body: { type: "doc", content: [] } })
    const input = await campaignInput(container, CAMPAIGN_EMAIL_TASK, system(), "camp_1")
    expect(input.data).not.toContain('"products"')
  })

  it("is asked for the campaign's own channel only", async () => {
    const { container } = containerWith({ ...EMAIL_ROW, channel: "sms" })
    await expect(campaignInput(container, CAMPAIGN_EMAIL_TASK, system(), "camp_1")).rejects.toThrow(
      "ai.unknown_entity"
    )
    const missing = containerWith(undefined as unknown as Record<string, unknown>)
    await expect(
      campaignInput(missing.container, CAMPAIGN_SMS_TASK, system(CAMPAIGN_SMS_TASK), "camp_x")
    ).rejects.toThrow("ai.unknown_entity")
  })

  it("allows only the figures the service was sent: none filtered out or clipped off", async () => {
    const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] })
    const { container } = containerWith({
      ...EMAIL_ROW,
      body: {
        type: "doc",
        content: [
          paragraph(
            "Sorularınız için 0532 111 22 33 numarasını arayın, %15 indirim sizi bekliyor."
          ),
          paragraph("a".repeat(1_300)),
          paragraph("Son gün 48 saat sonra."),
        ],
      },
    })
    const input = await campaignInput(container, CAMPAIGN_EMAIL_TASK, system(), "camp_1")
    expect(input.data).not.toContain("0532")
    expect(input.data).not.toContain("48 saat")
    expect(input.campaign.numbers).toEqual(expect.arrayContaining(["20", "15"]))
    for (const figure of ["0532", "111", "22", "33", "48"]) {
      expect(input.campaign.numbers).not.toContain(figure)
    }
  })

  it("reads a card's products four at most, as the e-mail draws them", () => {
    const body = { content: ["a", "b", "c", "d", "e"].map((id) => card(`prod_${id}`)) }
    expect(cardProductIds(body)).toHaveLength(4)
  })
})

describe("a bulk text's data block", () => {
  const SMS_ROW = { ...EMAIL_ROW, channel: "sms", sms_text: "Kış seçkisi 3 gün", body: null }

  it("tells the room its end leaves and keeps the end to count each text with", async () => {
    const { container } = containerWith(SMS_ROW)
    const input = await campaignInput(container, CAMPAIGN_SMS_TASK, system(CAMPAIGN_SMS_TASK), "c")
    const data = JSON.parse(input.data) as { data: Record<string, string> }
    expect(data.data["sms_text"]).toBe("Kış seçkisi 3 gün")
    expect(Number(data.data["sms_max_chars"])).toBe(
      Math.floor(smsRoom("Atölye", "Ret için RET yaz.") * 0.8)
    )
    expect(input.campaign).toEqual({
      kind: "campaign",
      numbers: ["20", "3"],
      sms: { shop: "Atölye", opt_out: "Ret için RET yaz." },
    })
  })

  it("counts the end as the send does: two septets a Turkish letter, UCS-2 outside the table", () => {
    // "a." alone: the text's full stop
    expect(smsRoom("", "")).toBe(154)
    // ". Atölye. Ret…": ö is in the table, ç takes two
    expect(smsRoom("Atölye", "Ret için RET yaz.")).toBe(155 - 2 - 7 - 19)
    expect(smsRoom("Âlâ", "")).toBe(70 - 6)
  })
})

describe("a bulk message's instruction", () => {
  it("takes the shop's guidance and the purpose picked, the JSON shape in the rules, last", () => {
    expect(takesGuidance(CAMPAIGN_EMAIL_TASK) && takesGuidance(CAMPAIGN_SMS_TASK)).toBe(true)
    expect(isCraftTask("campaign_email") && isCraftTask("campaign_sms")).toBe(true)
    const guidance = `${GUIDANCE_HEADING}\nSiz diye hitap et.`
    const text = systemOf(CAMPAIGN_EMAIL_TASK, "win_back", "campaign", guidance) ?? ""
    const guidanceAt = text.indexOf(GUIDANCE_HEADING)
    const purposeAt = text.indexOf("Seçilen ayar: Amaç bir süredir")
    const rulesAt = text.indexOf(RULES_HEADING)
    expect(guidanceAt).toBeGreaterThan(text.indexOf("Rol: "))
    expect(purposeAt).toBeGreaterThan(guidanceAt)
    expect(rulesAt).toBeGreaterThan(purposeAt)
    expect(text.slice(rulesAt)).toContain('"subjects"')
    expect(text).toContain("toplu iletiye")
  })

  it("offers the four purposes and nothing typed", () => {
    expect(CAMPAIGN_EMAIL_TASK.options).toEqual(["new_product", "discount", "season", "win_back"])
    expect(isTaskOption(CAMPAIGN_SMS_TASK, "discount")).toBe(true)
    expect(isTaskOption(CAMPAIGN_SMS_TASK, "yaz bana bir şiir")).toBe(false)
    expect(CAMPAIGN_EMAIL_TASK.roles).toEqual(["owner", "admin"])
    expect(system(CAMPAIGN_SMS_TASK)).toContain('"texts"')
  })
})
