import { describe, expect, it } from "vitest"
import { panelOrigins, parseStorefrontEnv } from "../env"
import { contentSecurityPolicy } from "../security/csp"

const BASE = {
  MEDUSA_BACKEND_URL: "http://localhost:9000",
  STOREFRONT_ORIGIN: "http://localhost:8000",
}

const PRODUCTION = {
  NODE_ENV: "production",
  MEDUSA_BACKEND_URL: "https://api.ornek.com",
  STOREFRONT_ORIGIN: "https://ornek.com",
  STOREFRONT_PUBLISHABLE_KEY: `pk_${"a".repeat(16)}`,
  STOREFRONT_IP_SECRET: "x".repeat(32),
  STOREFRONT_TRUSTED_PROXY_HOPS: "1",
}

describe("the panel that frames previews (adr/0049)", () => {
  it("is the dev panel in development, none deployed until set", () => {
    expect(panelOrigins(parseStorefrontEnv({ ...BASE, NODE_ENV: "development" }))).toEqual([
      "http://localhost:5173",
    ])
    expect(panelOrigins(parseStorefrontEnv(PRODUCTION))).toEqual([])
    expect(
      panelOrigins(parseStorefrontEnv({ ...PRODUCTION, PANEL_ORIGIN: "https://panel.ornek.com/x" }))
    ).toEqual(["https://panel.ornek.com"])
  })

  it("must be https when deployed", () => {
    expect(() =>
      parseStorefrontEnv({ ...PRODUCTION, PANEL_ORIGIN: "http://panel.ornek.com" })
    ).toThrow(/PANEL_ORIGIN: must be https/)
  })

  it("is named in frame-ancestors only where a page asks for it", () => {
    expect(contentSecurityPolicy("n", false, { framedBy: ["https://panel.ornek.com"] })).toContain(
      "frame-ancestors https://panel.ornek.com"
    )
    expect(contentSecurityPolicy("n", false)).toContain("frame-ancestors 'none'")
    expect(
      contentSecurityPolicy("n", false, { framedBySelf: true, framedBy: ["https://p.ornek.com"] })
    ).toContain("frame-ancestors 'self' https://p.ornek.com")
  })
})
