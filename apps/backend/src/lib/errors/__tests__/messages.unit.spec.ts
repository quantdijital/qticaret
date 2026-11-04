import { SERVER_ERROR_MESSAGES_EN, SERVER_ERROR_MESSAGES_TR, serverErrorMessage } from "../messages"

describe("server error messages", () => {
  it("have the same keys in Turkish and English, each a real sentence", () => {
    expect(Object.keys(SERVER_ERROR_MESSAGES_EN).sort()).toEqual(
      Object.keys(SERVER_ERROR_MESSAGES_TR).sort()
    )
    for (const text of [
      ...Object.values(SERVER_ERROR_MESSAGES_TR),
      ...Object.values(SERVER_ERROR_MESSAGES_EN),
    ]) {
      expect(text.trim().length).toBeGreaterThan(0)
    }
  })

  it("keys are the API's message keys", () => {
    for (const key of Object.keys(SERVER_ERROR_MESSAGES_TR)) {
      expect(key).toMatch(/^[a-z_]+\.[a-z_]+$/)
    }
  })

  it("gives a key's sentence, or a generic one naming an unknown key", () => {
    expect(serverErrorMessage("errors.limit_too_large")).toBe(
      "Tek seferde bu kadar çok kayıt istenemez."
    )
    expect(serverErrorMessage("errors.limit_too_large", "en")).toBe(
      "Too many records were asked for at once."
    )
    expect(serverErrorMessage("nope.missing")).toContain("nope.missing")
    // Own keys only
    expect(serverErrorMessage("__proto__")).toContain("__proto__")
  })

  it("puts what the error named in its sentence, and leaves the sentence's own braces", () => {
    const tokens = { tokens: "{uydurma}, {adres" }
    expect(serverErrorMessage("legal.token_invalid", "tr", tokens)).toBe(
      "Metinde tanınmayan ya da yarım kalmış belirteç var: {uydurma}, {adres. Belirteçler {mağaza_unvanı} biçiminde ve listedeki adlarla yazılır."
    )
    expect(serverErrorMessage("legal.token_invalid", "en", tokens)).toContain(
      "tokens: {uydurma}, {adres."
    )
    expect(serverErrorMessage("legal.token_invalid")).not.toContain("{{")
  })
})
