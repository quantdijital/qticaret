import { mailLogoUrl, storefrontUrlOf } from "../brand"

const development = { NODE_ENV: "development" as const }
const production = { NODE_ENV: "production" as const }

describe("a message's storefront links", () => {
  it("go to the shop's canonical host over https wherever it runs", () => {
    for (const env of [development, production, { NODE_ENV: "test" as const }]) {
      expect(storefrontUrlOf("magaza.example.com", env)).toBe("https://magaza.example.com")
    }
  })

  it("go to the dev storefront on a developer's machine until a host is set", () => {
    expect(storefrontUrlOf(null, development)).toBe("http://localhost:8000")
    expect(
      storefrontUrlOf(null, { ...development, STOREFRONT_ORIGIN: "http://127.0.0.1:8100" })
    ).toBe("http://127.0.0.1:8100")
  })

  it("are none until a host is set where the shop runs, and in tests (the deployed rule)", () => {
    expect(storefrontUrlOf(null, production)).toBeNull()
    expect(storefrontUrlOf(null, { NODE_ENV: undefined })).toBeNull()
    expect(storefrontUrlOf(null, { NODE_ENV: "staging" })).toBeNull()
    expect(storefrontUrlOf(null, { NODE_ENV: "test" })).toBeNull()
    // A storefront address set for the refresh signal is not the shop's public host
    expect(
      storefrontUrlOf(null, { ...production, STOREFRONT_ORIGIN: "https://vitrin.internal" })
    ).toBeNull()
  })
})

describe("a message's logo", () => {
  it("is an https address wherever it runs, and never a relative one", () => {
    expect(mailLogoUrl("https://cdn.example.com/logo.png", production)).toBe(
      "https://cdn.example.com/logo.png"
    )
    expect(mailLogoUrl("/static/logo.png", development)).toBeNull()
    expect(mailLogoUrl(null, development)).toBeNull()
  })

  it("may come over http from the local file store on a developer's machine only", () => {
    const local = "http://localhost:58333/qticaret/logo.png"

    expect(mailLogoUrl(local, development)).toBe(local)
    expect(mailLogoUrl(local, production)).toBeNull()
    expect(mailLogoUrl(local, { NODE_ENV: "test" })).toBeNull()
  })
})
