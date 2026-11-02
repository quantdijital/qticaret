import { exportedItems } from "../kvkk"

describe("a gift line in the buyer's copy of their data (adr/0025 Ek 2026-11-03)", () => {
  it("shows the recipient and the cards' last characters, never the line's other notes", () => {
    const items = exportedItems([
      {
        title: "Hediye Kartı",
        quantity: 1,
        metadata: {
          qt_gift: { recipient_email: "zeynep@example.com", message: "Mutlu yıllar" },
          qt_gift_cards: [{ id: "gcard_1", last4: "NPQR" }],
          qt_fee: true,
        },
      },
      { title: "Kupa", quantity: 1, metadata: { qt_fee: true } },
      null,
    ])
    expect(items).toEqual([
      {
        title: "Hediye Kartı",
        quantity: 1,
        hediye: {
          alıcı_e_posta: "zeynep@example.com",
          alıcı_adı: null,
          mesaj: "Mutlu yıllar",
          gönderen_adı: null,
          kartlar: ["…NPQR"],
        },
      },
      { title: "Kupa", quantity: 1 },
      null,
    ])
  })

  it("leaves what is not a list alone", () => {
    expect(exportedItems(undefined)).toBeUndefined()
  })
})
