import { devCheckoutCsp, devCheckoutPage } from "../page"

describe("devCheckoutPage (adr/0028)", () => {
  it("puts the style, the script and the nonce in, and the settings as inert JSON", () => {
    const html = devCheckoutPage(
      {
        publishableKey: "pk_</script><script>alert(1)</script>",
        panelUrl: "http://localhost:5173",
      },
      "bm9uY2U="
    )

    expect(html).not.toMatch(/__(STYLE|SCRIPT|CONFIG|NONCE)__/)
    expect(html).toContain('<script nonce="bm9uY2U=">')
    expect(html).toContain('<style nonce="bm9uY2U=">')
    expect(html).toContain("/store/carts")
    // The key cannot close the JSON's script tag
    expect(html).not.toContain("</script><script>alert(1)")
    expect(html).toContain("\\u003c/script>")
  })

  it("allows only the response's own inline code, and calls to its own origin", () => {
    const csp = devCheckoutCsp("abc")

    expect(csp).toContain("script-src 'nonce-abc'")
    expect(csp).toContain("connect-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain("unsafe-inline")
  })
})
