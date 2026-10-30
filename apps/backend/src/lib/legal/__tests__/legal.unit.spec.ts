import type { Block, ContentDoc } from "../../content"
import { contentDoc, renderDoc } from "../../content"
import { LEGAL_KINDS, checkLegalDoc, fillLegalDoc, starterOf } from ".."

const doc = (...content: Block[]): ContentDoc => ({ type: "doc", content })
const p = (text: string): Block => ({ type: "paragraph", content: [{ type: "text", text }] })

describe("legal texts (adr/0041 §1)", () => {
  it.each(LEGAL_KINDS)("starts %s from a draft the editor takes and the checker passes", (kind) => {
    const { title, body } = starterOf(kind)

    expect(title.length).toBeGreaterThan(0)
    expect(contentDoc.safeParse(body).success).toBe(true)
    expect(checkLegalDoc(body, kind)).toEqual({ unknownTokens: [], isMalformed: false })
    // Each says it is a draft for a lawyer to check
    expect(renderDoc(body)).toContain("avukatınıza")
  })

  it("refuses an unknown token, a token split by formatting, and an order's in a policy", () => {
    expect(checkLegalDoc(doc(p("{mağaza_unvanı} {uydurma}")), "privacy_notice")).toEqual({
      unknownTokens: ["uydurma"],
      isMalformed: false,
    })
    expect(checkLegalDoc(doc(p("Ad: {alıcı_adı")), "distance_sales").isMalformed).toBe(true)
    expect(checkLegalDoc(doc(p("{alıcı_adı}")), "return_policy").unknownTokens).toEqual([
      "alıcı_adı",
    ])
    expect(checkLegalDoc(doc(p("{alıcı_adı}")), "distance_sales").unknownTokens).toEqual([])
  })

  it("fills text tokens, opens a block token at the top only, and marks what has no value", () => {
    const lines: Block[] = [{ type: "table", content: [] }]
    const filled = fillLegalDoc(
      doc(p("Satıcı: {mağaza_unvanı}, MERSİS: {mersis}"), p("{sipariş_kalemleri}"), {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "{sipariş_kalemleri}" }] },
            ],
          },
        ],
      }),
      {
        text: { mağaza_unvanı: "Örnek Ltd. Şti.", mersis: "" },
        blocks: { sipariş_kalemleri: lines },
      }
    )

    expect(filled.content[0]).toEqual(p("Satıcı: Örnek Ltd. Şti., MERSİS: —"))
    expect(filled.content[1]).toEqual(lines[0])
    expect(JSON.stringify(filled.content[2])).toContain('"text":"—"')
  })
})
