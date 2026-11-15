import { MAX_PROVIDER_TEXT, providerText } from "../provider-text"

describe("providerText", () => {
  it("keeps a provider's own sentence as one clean line", () => {
    expect(providerText("Kullanıcı adı veya şifre hatalı")).toBe("Kullanıcı adı veya şifre hatalı")
    expect(providerText("  Alıcı adresi\r\n\teksik.  ")).toBe("Alıcı adresi eksik.")
    // A provider's text cannot turn ours around
    expect(providerText("Hata‮ kodu\u0000 936")).toBe("Hata kodu 936")
  })

  it("masks the account's own values wherever they are quoted", () => {
    const said = providerText(
      "aras-1234 kullanıcısına ait QT12 anahtarı yok; şifre Gizli-99 hatalı",
      [
        "aras-1234",
        "gizli-99",
        null,
        "",
        // Too short to be a secret: it would blank words
        "ab",
      ]
    )
    expect(said).toBe("*** kullanıcısına ait QT12 anahtarı yok; şifre *** hatalı")
  })

  it("masks addresses of services, credentials and personal data", () => {
    const said =
      providerText(
        "Bkz. https://customerws.araskargo.com.tr/svc?x=1, www.ornek.com ve api.ornek.com.tr:8443/v1; " +
          "sunucu 10.0.0.12:443; token=abc123; ayse@example.com; 0532 123 45 67; " +
          // A made-up key in a live key's shape, built so no scanner mistakes it for one
          "anahtar " +
          ["sk", "live", "0123456789abcdefABCDEF"].join("_")
      ) ?? ""
    for (const leak of [
      "araskargo",
      "www.ornek",
      "api.ornek",
      "10.0.0.12",
      "abc123",
      "ayse@",
      "0532",
      "0123456789abcdef",
    ]) {
      expect(said).not.toContain(leak)
    }
    expect(said).toContain("***")
  })

  it("cuts a long text short, on a whole character", () => {
    const said = providerText("ş".repeat(300)) ?? ""
    expect(Array.from(said)).toHaveLength(MAX_PROVIDER_TEXT)
    expect(said.endsWith("…")).toBe(true)
  })

  it("gives nothing for what is not readable text", () => {
    expect(providerText(undefined)).toBeUndefined()
    expect(providerText(42)).toBeUndefined()
    expect(providerText("   ")).toBeUndefined()
    expect(providerText("https://ornek.com/x")).toBeUndefined()
    expect(providerText("pw", ["pw!"])).toBe("pw")
  })
})
