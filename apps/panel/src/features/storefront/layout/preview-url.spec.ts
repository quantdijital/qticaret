import { describe, expect, it } from "vitest"
import { storefrontHome } from "./preview-url"

describe("where 'Mağazayı görüntüle' goes", () => {
  it("opens the bound domain over https, whatever else is known", () => {
    expect(
      storefrontHome("magaza.example.com", "https://vitrin.example.net", "http://localhost:8000")
    ).toBe("https://magaza.example.com")
    expect(storefrontHome("magaza.example.com", null, null)).toBe("https://magaza.example.com")
  })

  it("opens the address the backend gives while no domain is bound, before the dev fallback", () => {
    expect(storefrontHome(null, "https://vitrin.example.net", "http://localhost:8000")).toBe(
      "https://vitrin.example.net"
    )
    expect(storefrontHome("", "http://localhost:8000", null)).toBe("http://localhost:8000")
  })

  it("falls back to the storefront it frames only when the backend gives nothing usable", () => {
    expect(storefrontHome(null, null, "http://localhost:8000")).toBe("http://localhost:8000")
    expect(storefrontHome(undefined, undefined, "http://localhost:8000")).toBe(
      "http://localhost:8000"
    )
    expect(storefrontHome(null, "javascript:alert(1)", "http://localhost:8000")).toBe(
      "http://localhost:8000"
    )
  })

  it("refuses an address out of shape: another scheme, no scheme, or more than an origin", () => {
    expect(storefrontHome(null, null, null)).toBeNull()
    for (const served of [
      "javascript:alert(1)",
      "data:text/html,x",
      "//vitrin.example.com",
      "vitrin.example.com",
      "https://",
    ]) {
      expect(storefrontHome(null, served, null)).toBeNull()
    }
    // A path or query never rides along
    expect(storefrontHome(null, "https://vitrin.example.net/yol?x=1", null)).toBe(
      "https://vitrin.example.net"
    )
    for (const host of ["magaza.example.com/yol", "kisi@kotu.example", "bozuk host"]) {
      expect(storefrontHome(host, "https://vitrin.example.net", null)).toBeNull()
    }
  })
})
