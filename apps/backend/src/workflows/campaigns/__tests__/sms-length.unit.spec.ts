import type { MedusaContainer } from "@medusajs/framework/types"
import {
  LONGEST_FIRST_NAME,
  LONGEST_NAME,
  SMS_MAX_PARTS,
  composeSms,
  smsLength,
} from "../../../lib/campaigns/sms"
import { fillName } from "../../../lib/campaigns/tokens"
import type { Brand } from "../../../lib/messaging/templates"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { GREETING, personName } from "../../messaging/loaders/types"
import { checkContent } from "../content"
import { smsPartsOf } from "../sms-length"

const brand: Brand = {
  shopName: "Örnek Mağaza",
  logoUrl: null,
  color: "#111827",
  contactEmail: "destek@magaza.example",
  contactPhone: null,
  storefrontUrl: "https://magaza.example",
}

jest.mock("../../messaging/brand", () => ({ brandOf: jest.fn(() => Promise.resolve(brand)) }))
jest.mock("../../shop/info-values", () => ({ shopInfoValues: jest.fn(() => Promise.resolve({})) }))

const OPT_OUT = "Ret için RET yazıp 4600'e gönderin."
const UTM = "kis-indirimi-a1b2c3"
const LINK = "https://magaza.example/indirim"

const container = {
  resolve: (key: string) => {
    if (key !== PLATFORM_SETTINGS_MODULE) {
      throw new Error(`unexpected ${key}`)
    }
    return {
      getSection: (name: string) =>
        Promise.resolve(name === "marketing" ? { sms_opt_out_text: OPT_OUT } : {}),
    }
  },
} as unknown as MedusaContainer

/** The count the save check made before (adr/0050 open items): as typed, the greeting for `{ad}`. */
const asTyped = (text: string) =>
  smsLength(composeSms(fillName(text, GREETING), brand.shopName, OPT_OUT))

/** `head`, `a`s up to the last septet three parts hold as typed, `tail`. */
const atTheEdge = (head: string, tail: string): string =>
  `${head}${"a".repeat(SMS_MAX_PARTS * 149 - asTyped(`${head}${tail}`).units)}${tail}`

const draft = (sms_text: string) => ({
  name: "Kış indirimi",
  channel: "sms" as const,
  audience: [],
  subject: null,
  preheader: null,
  body: null,
  sms_text,
})

const counted = (sms_text: string) => smsPartsOf(container, { sms_text, utm_campaign: UTM })

describe("a bulk text's parts as it goes (adr/0050 §4)", () => {
  it("counts a link's utm and the longest name: three parts as typed, four as it goes", async () => {
    const text = atTheEdge("{ad}, kış indirimi başladı ", ` ${LINK}`)
    expect(asTyped(text)).toMatchObject({ encoding: "gsm", units: 447, parts: 3 })
    expect(await counted(text)).toBe(4)
    await expect(checkContent(container, draft(text), UTM)).rejects.toMatchObject({
      safeMessage: "campaigns.sms_too_long",
      field: "sms_text",
    })
  })

  it("counts each on its own: the utm of a shop link, the longest name", async () => {
    expect(await counted(atTheEdge("Kış indirimi başladı ", ` ${LINK}`))).toBe(4)
    expect(await counted(atTheEdge("{ad}, kış indirimi başladı ", " Son gün yarın."))).toBe(4)
  })

  it("counts a text with no shop link and no name as typed", async () => {
    const plain = atTheEdge("Kış indirimi başladı ", " Son gün yarın.")
    expect(await counted(plain)).toBe(3)
    await expect(checkContent(container, draft(plain), UTM)).resolves.toBeUndefined()
    // A link elsewhere carries no utm of ours
    const elsewhere = atTheEdge("Kış indirimi başladı ", " https://ornek.org/kis")
    expect(await counted(elsewhere)).toBe(3)
    expect(await counted("Kış indirimi başladı")).toBe(
      smsLength(composeSms("Kış indirimi başladı", brand.shopName, OPT_OUT)).parts
    )
  })

  it("stands in the longest name a message greets with, at two septets a letter", () => {
    expect(personName(LONGEST_NAME)).toBe(LONGEST_NAME)
    expect(personName(`${LONGEST_NAME}ş`)).toBeNull()
    expect(smsLength(LONGEST_NAME)).toMatchObject({
      encoding: "gsm",
      units: 2 * LONGEST_FIRST_NAME,
    })
  })
})
