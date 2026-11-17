import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { contentSecurityPolicy, RADIX_STYLE_HASHES } from "../csp"

const directive = (policy: string, name: string) =>
  policy.split("; ").find((each) => each.startsWith(`${name} `))

describe("contentSecurityPolicy", () => {
  it("in production allows styles by nonce and only Radix's known style attributes", () => {
    const policy = contentSecurityPolicy("abc123", false)
    const hash = (value: string) =>
      `'sha256-${createHash("sha256").update(value).digest("base64")}'`

    expect(directive(policy, "style-src")).toBe("style-src 'self' 'nonce-abc123'")
    expect(directive(policy, "style-src-attr")).toBe(
      `style-src-attr 'unsafe-hashes' ${hash("position:relative")} ${hash("pointer-events:none")}`
    )
    expect(policy).not.toContain("'unsafe-inline'")
    expect(directive(policy, "script-src")).toBe(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'"
    )
  })

  it("hashes exactly the attribute values Radix writes, nothing more", () => {
    // The browser hashes the attribute's value as written: no spaces, no `;`
    const values = ["position:relative", "pointer-events:none"]
    expect(RADIX_STYLE_HASHES).toEqual(
      values.map((value) => `'sha256-${createHash("sha256").update(value).digest("base64")}'`)
    )
    expect(RADIX_STYLE_HASHES).toContain("'sha256-1OjyRYLAOH1vhXLUN4bBHal0rWxuwBDBP220NNc0CNU='")
  })

  it("relaxes what Next's dev server needs in development only", () => {
    const policy = contentSecurityPolicy("abc123", true)

    expect(directive(policy, "style-src")).toBe("style-src 'self' 'unsafe-inline'")
    expect(directive(policy, "style-src-attr")).toBeUndefined()
    expect(directive(policy, "script-src")).toContain("'unsafe-eval'")
  })

  it("plays a product's videos from any HTTPS host, plain HTTP in development only (adr/0069 §5)", () => {
    const production = contentSecurityPolicy("abc123", false)
    expect(directive(production, "media-src")).toBe("media-src 'self' https:")
    expect(directive(production, "media-src")).toBe(
      directive(production, "img-src")?.replace("img-src 'self' data: blob:", "media-src 'self'")
    )
    const development = contentSecurityPolicy("abc123", true)
    expect(directive(development, "media-src")).toBe("media-src 'self' https: http:")
  })

  it("frames YouTube's privacy-enhanced player and nothing else of YouTube's (adr/0069 §8)", () => {
    const production = contentSecurityPolicy("abc123", false)
    expect(directive(production, "frame-src")).toBe("frame-src https://www.youtube-nocookie.com")
    expect(contentSecurityPolicy("abc123", true)).toContain(
      "frame-src https://www.youtube-nocookie.com;"
    )
    // The one origin, in the one directive: no scripts, pictures, connections or media of its own
    expect(production.match(/youtube/g)).toHaveLength(1)
    expect(production).not.toMatch(/youtube\.com|ytimg|googlevideo|\*\.youtube/)
    for (const name of ["script-src", "connect-src", "img-src", "media-src", "default-src"]) {
      expect(directive(production, name)).not.toContain("youtube")
    }
    // The page itself is still framed by nobody
    expect(directive(production, "frame-ancestors")).toBe("frame-ancestors 'none'")
  })

  it("frames only the card providers' forms, and lets the payment return sit in our own frame", () => {
    const closed = contentSecurityPolicy("abc123", false)
    expect(directive(closed, "frame-src")).toBe("frame-src https://www.youtube-nocookie.com")
    expect(directive(closed, "frame-ancestors")).toBe("frame-ancestors 'none'")

    const checkout = contentSecurityPolicy("abc123", false, {
      frameOrigins: ["https://www.paytr.com"],
      framedBySelf: true,
    })
    expect(directive(checkout, "frame-src")).toBe(
      "frame-src https://www.youtube-nocookie.com https://www.paytr.com"
    )
    expect(directive(checkout, "frame-ancestors")).toBe("frame-ancestors 'self'")
  })

  it("opens the measurement tags' hosts only for the tags the shop connected (docs/20)", () => {
    const none = contentSecurityPolicy("abc123", false)
    expect(directive(none, "connect-src")).toBe("connect-src 'self'")
    expect(none).not.toMatch(/google|facebook/)

    const google = contentSecurityPolicy("abc123", false, { tags: { google: true, meta: false } })
    expect(directive(google, "script-src")).toBe(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic' https://www.googletagmanager.com"
    )
    expect(directive(google, "connect-src")).toBe(
      "connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com"
    )
    expect(google).not.toContain("facebook")

    const meta = contentSecurityPolicy("abc123", false, { tags: { google: false, meta: true } })
    expect(directive(meta, "script-src")).toContain("https://connect.facebook.net")
    expect(directive(meta, "connect-src")).toBe(
      "connect-src 'self' https://connect.facebook.net https://www.facebook.com"
    )
    expect(meta).not.toContain("google")
    // Nothing else opens: no frames but YouTube's player, no other scripts
    expect(directive(meta, "frame-src")).toBe("frame-src https://www.youtube-nocookie.com")
  })
})
