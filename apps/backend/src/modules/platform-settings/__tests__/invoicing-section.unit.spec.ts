import { fakeVkn, seededRandom } from "@qticaret/testing"
import { SECTIONS, mergePatch } from "../sections"
import { parseStored } from "../sections/stored"

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? []

describe("invoicing section (F8, adr/0034 §1)", () => {
  const { full, patch, defaults } = SECTIONS.invoicing
  const vkn = fakeVkn(seededRandom(8))

  it("starts with nothing issued, once paid, no carrier named and no series", () => {
    expect(full.parse(defaults)).toEqual({
      provider: "none",
      trigger: "placed",
      carriers: {},
      series: null,
    })
  })

  it("takes a series of three letters or digits, upper-cased, and refuses others", () => {
    expect(full.parse(mergePatch(defaults, patch.parse({ series: " web " }))).series).toBe("WEB")
    expect(messages(patch.safeParse({ series: "WEBX" }))).toContain(
      "platform_settings.invoice_series_invalid"
    )
    expect(full.parse(mergePatch(defaults, patch.parse({ series: null }))).series).toBeNull()
  })

  it("takes a carrier's registered name and tax id, one carrier at a time", () => {
    const first = mergePatch(
      defaults,
      patch.parse({ carriers: { aras: { title: " Örnek Kargo A.Ş. ", tax_id: vkn } } })
    )
    const second = mergePatch(
      full.parse(first),
      patch.parse({ provider: "parasut", carriers: { manual: { title: "Mağaza", tax_id: vkn } } })
    )

    expect(full.parse(second)).toEqual({
      provider: "parasut",
      trigger: "placed",
      series: null,
      carriers: {
        aras: { title: "Örnek Kargo A.Ş.", tax_id: vkn },
        manual: { title: "Mağaza", tax_id: vkn },
      },
    })
  })

  it("refuses a tax id that is none, a control character, and a carrier we do not ship with", () => {
    expect(
      messages(patch.safeParse({ carriers: { aras: { title: "Kargo", tax_id: "1234567891" } } }))
    ).toContain("platform_settings.tax_number_invalid")
    expect(
      messages(patch.safeParse({ carriers: { aras: { title: "Kargo\u0007", tax_id: vkn } } }))
    ).toContain("platform_settings.text_invalid")
    expect(patch.safeParse({ carriers: { mng: { title: "Kargo", tax_id: vkn } } }).success).toBe(
      false
    )
  })

  it("drops a carrier no longer offered from a stored row and keeps the others", () => {
    const aras = { title: "Örnek Kargo A.Ş.", tax_id: vkn }
    const stored = { ...defaults, carriers: { aras, retired: { title: "Eski", tax_id: vkn } } }

    expect(parseStored("invoicing", stored)["carriers"]).toEqual({ aras })
  })
})
