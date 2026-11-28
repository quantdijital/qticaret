import { appearanceSection } from "../sections/appearance"

const { patch } = appearanceSection

describe("appearance section: the brand pictures' addresses", () => {
  it.each([
    "https://cdn.magaza.example/logo.svg",
    // The local file store (tests, a developer's machine): its own address
    "http://localhost/static/logo.svg",
    "/static/logo.png",
  ])("takes %s (which one is the shop's upload is the workflow's to say)", (url) => {
    expect(patch.safeParse({ logo_light_url: url, favicon_url: url }).success).toBe(true)
  })

  it.each([
    ["a backslash", "/\\evil.example/logo.png"],
    ["a backslash in a host", "https://cdn.magaza.example\\@evil.example/x.png"],
    ["a protocol-relative address", "//evil.example/logo.png"],
    // Browsers drop tabs and line breaks from addresses: `/\t/host` is `//host`
    ["a tab", "/\t/evil.example/logo.png"],
    ["a line break", "/\n/evil.example/logo.png"],
    ["a script", "javascript:alert(1)"],
    ["inline data", "data:image/svg+xml;base64,AAAA"],
  ])("refuses %s", (_name, url) => {
    expect(patch.safeParse({ logo_dark_url: url }).success).toBe(false)
  })
})

describe("appearance section: the surfaces' tone", () => {
  it("starts from the brand-tinted look a row saved before the choice keeps", () => {
    expect(appearanceSection.defaults.surface).toBe("brand")
  })

  it.each(["brand", "neutral", "warm", "cool"])("takes %s", (surface) => {
    expect(patch.safeParse({ surface }).success).toBe(true)
  })

  it("refuses a tone it does not know", () => {
    expect(patch.safeParse({ surface: "red" }).success).toBe(false)
  })
})
