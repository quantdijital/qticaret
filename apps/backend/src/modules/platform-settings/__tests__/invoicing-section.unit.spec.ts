import { fakeVkn, seededRandom } from "@qticaret/testing"
import { SECTIONS, mergePatch } from "../sections"

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? []

describe("invoicing section (F8, adr/0034 §1)", () => {
  const { full, patch, defaults } = SECTIONS.invoicing
  const vkn = fakeVkn(seededRandom(8))

  it("starts with nothing issued, on shipping, no carrier named", () => {
    expect(full.parse(defaults)).toEqual({ provider: "none", trigger: "shipped", carriers: {} })
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
      trigger: "shipped",
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
})
