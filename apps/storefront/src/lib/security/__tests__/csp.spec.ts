import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { contentSecurityPolicy } from "../csp"

const directive = (policy: string, name: string) =>
  policy.split("; ").find((each) => each.startsWith(`${name} `))

describe("contentSecurityPolicy", () => {
  it("in production allows styles by nonce and only Radix's known style attribute", () => {
    const policy = contentSecurityPolicy("abc123", false)
    const hash = createHash("sha256").update("position:relative").digest("base64")

    expect(directive(policy, "style-src")).toBe("style-src 'self' 'nonce-abc123'")
    expect(directive(policy, "style-src-attr")).toBe(
      `style-src-attr 'unsafe-hashes' 'sha256-${hash}'`
    )
    expect(policy).not.toContain("'unsafe-inline'")
    expect(directive(policy, "script-src")).toBe(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'"
    )
  })

  it("relaxes what Next's dev server needs in development only", () => {
    const policy = contentSecurityPolicy("abc123", true)

    expect(directive(policy, "style-src")).toBe("style-src 'self' 'unsafe-inline'")
    expect(directive(policy, "style-src-attr")).toBeUndefined()
    expect(directive(policy, "script-src")).toContain("'unsafe-eval'")
  })

  it("frames only the card providers' forms, and lets the payment return sit in our own frame", () => {
    const closed = contentSecurityPolicy("abc123", false)
    expect(directive(closed, "frame-src")).toBe("frame-src 'none'")
    expect(directive(closed, "frame-ancestors")).toBe("frame-ancestors 'none'")

    const checkout = contentSecurityPolicy("abc123", false, {
      frameOrigins: ["https://www.paytr.com"],
      framedBySelf: true,
    })
    expect(directive(checkout, "frame-src")).toBe("frame-src https://www.paytr.com")
    expect(directive(checkout, "frame-ancestors")).toBe("frame-ancestors 'self'")
  })
})
