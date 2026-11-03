import { messageAddonsOf } from "../line-addons"

/** adr/0052 §9: an order line's add-on record as its messages print it. */
describe("messageAddonsOf", () => {
  const record = (items: unknown[], nonWithdrawable = false) => ({
    other: "kept",
    qt_addons: { items, base: 1000, non_withdrawable: nonWithdrawable, max_quantity: 10 },
  })

  it("names the typed text and the chosen option, with each paid pick's unit price", () => {
    expect(
      messageAddonsOf(
        record(
          [
            {
              addon_id: "a1",
              kind: "text",
              label: "Ürün üzerine yazı",
              value: "Ada",
              amount: 35,
              non_withdrawable: true,
            },
            {
              addon_id: "a2",
              kind: "choice",
              label: "Kılıf",
              choice_id: "c1",
              choice_label: "Desenli Siyah",
              amount: 300,
              non_withdrawable: false,
            },
            { addon_id: "a3", kind: "text", label: "Not", value: "Merhaba", amount: 0 },
          ],
          true
        )
      )
    ).toEqual({
      addons: [
        { label: "Ürün üzerine yazı", value: "Ada", amount: "₺35,00" },
        { label: "Kılıf", value: "Desenli Siyah", amount: "₺300,00" },
        { label: "Not", value: "Merhaba", amount: null },
      ],
      nonWithdrawable: true,
    })
  })

  it("says nothing of a line without add-ons", () => {
    expect(messageAddonsOf(null)).toEqual({})
    expect(messageAddonsOf({ other: "kept" })).toEqual({})
    expect(messageAddonsOf(record([]))).toEqual({})
  })

  it("prints an erased text as the erasure left it (adr/0052 §10)", () => {
    expect(
      messageAddonsOf(
        record([{ addon_id: "a1", kind: "text", label: "Yazı", value: "—", amount: 35 }])
      ).addons
    ).toEqual([{ label: "Yazı", value: "—", amount: "₺35,00" }])
  })
})
