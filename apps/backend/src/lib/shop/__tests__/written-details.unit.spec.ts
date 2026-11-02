import { writtenDetails } from "../written-details"

const contact = { phone: "+905342551145", whatsapp: "+905321234567", email: "Info@Ornek.com" }

describe("written shop details", () => {
  it("finds the shop's phone however it is spaced, its WhatsApp and its e-mail", () => {
    expect(writtenDetails("Bizi 0534 255 11 45 numarasından arayın.", contact)).toEqual(["telefon"])
    expect(writtenDetails("Tel: +90 (534) 255-1145", contact)).toEqual(["telefon"])
    expect(writtenDetails("WhatsApp: 0532 123 45 67 · info@ornek.com", contact)).toEqual([
      "whatsapp",
      "e_posta",
    ])
  })

  it("leaves other numbers, tokens and an unset contact alone", () => {
    expect(writtenDetails("Sipariş no 105342551145 ve {telefon}", contact)).toEqual([])
    expect(writtenDetails("0534 255 11 45", { phone: null, whatsapp: null, email: null })).toEqual(
      []
    )
  })

  it("names one number once when WhatsApp is the shop's phone", () => {
    const same = { ...contact, whatsapp: contact.phone }
    expect(writtenDetails("0534 255 11 45", same)).toEqual(["telefon"])
  })
})
