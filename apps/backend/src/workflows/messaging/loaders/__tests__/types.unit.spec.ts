import { addressLine, personName } from "../types"

/** What a shopper typed at checkout reaches a message only when it cannot be read as a link. */
describe("personName", () => {
  it("greets with a name as people write theirs", () => {
    expect(personName("  Ayşe ")).toBe("Ayşe")
    expect(personName("M. Ali")).toBe("M. Ali")
    expect(personName("Zeynep-Nur")).toBe("Zeynep-Nur")
  })

  it("leaves out what reads as a link, an address, a number or a sentence", () => {
    for (const typed of [
      "Hesabınız askıya alındı https://evil.example",
      "giris-yap.com adresine gidin",
      "www.evil",
      "ayse@example.com",
      "Arayın 0850",
      "Ayşe ".repeat(10),
      "",
      null,
      undefined,
    ]) {
      expect(personName(typed)).toBeNull()
    }
  })
})

describe("addressLine", () => {
  it("keeps an address as written and drops a line with a link in it", () => {
    expect(addressLine("Atatürk Cad. No: 5 D.3")).toBe("Atatürk Cad. No: 5 D.3")
    expect(addressLine("Ödeme için https://evil.example")).toBeNull()
    expect(addressLine("www.evil.example")).toBeNull()
    expect(addressLine("x".repeat(200))).toHaveLength(120)
  })
})
