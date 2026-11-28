import { supportSeoChangeRefused } from "../settings"

describe("supportSeoChangeRefused (re-review N-1)", () => {
  const stored = { canonical_host: "www.ornek-magaza.com" }

  it("refuses a new canonical host, a cleared one included", () => {
    expect(supportSeoChangeRefused({ canonical_host: "kotu.example" }, stored)).toBe(true)
    expect(supportSeoChangeRefused({ canonical_host: null }, stored)).toBe(true)
  })

  it("lets the stored host through as it is, and a save that does not send it", () => {
    expect(supportSeoChangeRefused({ canonical_host: "www.ornek-magaza.com" }, stored)).toBe(false)
    expect(supportSeoChangeRefused({ title_template: "{{name}} | Mağaza" }, stored)).toBe(false)
  })
})
