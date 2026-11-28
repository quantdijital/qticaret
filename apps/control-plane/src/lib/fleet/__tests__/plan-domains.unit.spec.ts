import { planDocumentSchema } from "@qticaret/types/control-plane"
import { fullLimits } from "../../plans/limits"
import { contentHash, planContent, planDocumentOf, planDomainsOf } from "../plan-content"

const NOW = new Date("2026-11-28T09:00:00Z")

const content = (domains?: ReturnType<typeof planDomainsOf>) =>
  planContent({
    tenantId: "ten_01JCP0TEST0000000000000000",
    status: "active",
    packageCode: "baslangic",
    packageLimits: fullLimits({ products: 500 }),
    packageFeatures: {},
    limitOverrides: [],
    flagOverrides: [],
    now: NOW,
    nodeEnv: "test",
    domains,
  })

const platform = {
  hostname: "atolye.quantticaret.com",
  kind: "platform_subdomain",
  verified: true,
  is_primary: true,
}
const own = (hostname: string, verified: boolean, is_primary = false) => ({
  hostname,
  kind: "custom",
  verified,
  is_primary,
})

describe("a shop's proved hosts in its plan document (F16.7)", () => {
  it("leaves the field out until the shop has a proved domain of its own", () => {
    expect(planDomainsOf([platform])).toBeUndefined()
    expect(planDomainsOf([platform, own("www.atolye.com.tr", false)])).toBeUndefined()
    // Unchanged content for shops without one: no document is issued again on deploy
    expect(contentHash(content(undefined))).toBe(contentHash(content(planDomainsOf([platform]))))
    expect("domains" in content(undefined)).toBe(false)
  })

  it("lists the proved hosts only, the primary among them", () => {
    const domains = planDomainsOf([
      { ...platform, is_primary: false },
      own("www.atolye.com.tr", true, true),
      own("atolye.com.tr", false),
    ])

    expect(domains).toEqual({
      primary: "www.atolye.com.tr",
      hosts: ["atolye.quantticaret.com", "www.atolye.com.tr"],
    })
    expect(planDocumentSchema.parse(planDocumentOf(content(domains), 2, NOW)).domains).toEqual(
      domains
    )
  })

  it("falls back to the platform subdomain as primary when none is marked", () => {
    expect(
      planDomainsOf([{ ...platform, is_primary: false }, own("www.atolye.com.tr", true)])?.primary
    ).toBe("atolye.quantticaret.com")
  })

  it("is refused by the contract when the primary is not among the hosts or a host is malformed", () => {
    const bad = { primary: "a.example.com", hosts: ["b.example.com"] }
    expect(() => planDocumentOf(content(bad), 1, NOW)).toThrow()
    expect(() =>
      planDocumentOf(content({ primary: "Bad Host", hosts: ["Bad Host"] }), 1, NOW)
    ).toThrow()
  })

  it("is still a valid document without the field (shops on an older contract)", () => {
    expect(() => planDocumentSchema.parse(planDocumentOf(content(undefined), 1, NOW))).not.toThrow()
  })
})
