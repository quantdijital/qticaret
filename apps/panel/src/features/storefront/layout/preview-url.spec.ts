import { describe, expect, it } from "vitest"
import { storefrontHome } from "./preview-url"

describe("where 'Mağazayı görüntüle' goes", () => {
  it("opens the bound domain over https, whatever the configured origin", () => {
    expect(storefrontHome("magaza.example.com", "http://localhost:8000")).toBe(
      "https://magaza.example.com"
    )
    expect(storefrontHome("magaza.example.com", null)).toBe("https://magaza.example.com")
  })

  it("opens the storefront's configured origin while no domain is bound", () => {
    expect(storefrontHome(null, "http://localhost:8000")).toBe("http://localhost:8000")
    expect(storefrontHome(undefined, "https://vitrin.example.com")).toBe(
      "https://vitrin.example.com"
    )
    expect(storefrontHome("", "https://vitrin.example.com")).toBe("https://vitrin.example.com")
  })

  it("offers nothing when neither is known, or the origin is not http(s)", () => {
    expect(storefrontHome(null, null)).toBeNull()
    expect(storefrontHome(null, "javascript:alert(1)")).toBeNull()
    expect(storefrontHome(null, "//vitrin.example.com")).toBeNull()
  })
})
