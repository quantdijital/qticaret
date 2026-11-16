import { storefrontHome } from "../home"

const deployed = { NODE_ENV: "production" as const }
const local = { NODE_ENV: "development" as const }

describe("where the panel's 'Mağazayı görüntüle' opens (vitrin adresi)", () => {
  it("opens the bound domain over https before anything the operator set", () => {
    expect(
      storefrontHome("magaza.example.com", {
        ...deployed,
        STOREFRONT_ORIGIN: "https://vitrin.example.net",
      })
    ).toBe("https://magaza.example.com")
    expect(storefrontHome("magaza.example.com", local)).toBe("https://magaza.example.com")
  })

  it("opens the storefront's configured origin while no domain is bound", () => {
    expect(
      storefrontHome(null, { ...deployed, STOREFRONT_ORIGIN: "https://vitrin.example.net" })
    ).toBe("https://vitrin.example.net")
    expect(
      storefrontHome("", { ...deployed, STOREFRONT_ORIGIN: "https://vitrin.example.net:8443" })
    ).toBe("https://vitrin.example.net:8443")
  })

  it("opens the local storefront on a developer's machine, nothing on a live shop with neither", () => {
    expect(storefrontHome(null, local)).toBe("http://localhost:8000")
    expect(storefrontHome(undefined, deployed)).toBeNull()
  })

  it("gives an origin only: a host that reads as more is none", () => {
    for (const host of ["magaza.example.com/yol?x=1", "kisi@kotu.example", "bozuk host"]) {
      expect(storefrontHome(host, deployed)).toBeNull()
    }
    expect(storefrontHome("Magaza.Example.com", deployed)).toBe("https://magaza.example.com")
  })
})
