import { describe, expect, it } from "vitest"
import {
  comparePlanSerial,
  planDocumentSchema,
  signedPlanDocumentSchema,
} from "../../control-plane/plan-document.js"
import {
  LIMIT_KEYS,
  LIMIT_REGISTRY,
  TENANT_STATUSES,
  TENANT_STATUS_TRANSITIONS,
  canTransitionTenant,
} from "../../control-plane/registry.js"
import {
  SIGNED_REQUEST_HEADERS,
  signedRequestHeadersSchema,
} from "../../control-plane/signature.js"
import { usagePeriodOf, usageReportSchema } from "../../control-plane/usage-report.js"
import { planDocument, usageReport } from "./fixtures.js"

const SIGNATURE = "A".repeat(86)

describe("plan document schema", () => {
  it("accepts the fixture", () => {
    expect(planDocumentSchema.parse(planDocument)).toEqual(planDocument)
  })

  it.each([
    ["at the top", { ...planDocument, revenue: 1 }],
    ["in limits", { ...planDocument, limits: { ...planDocument.limits, warehouses: 2 } }],
    ["in billing", { ...planDocument, billing: { ...planDocument.billing, iban: "TR00" } }],
  ])("refuses an unknown field %s", (_case, document) => {
    const result = planDocumentSchema.safeParse(document)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.code).toBe("unrecognized_keys")
  })

  it("refuses an unknown field around the document and its signature", () => {
    const signed = { document: planDocument, kid: "0123456789abcdef", signature: SIGNATURE }

    expect(signedPlanDocumentSchema.safeParse(signed).success).toBe(true)
    expect(signedPlanDocumentSchema.safeParse({ ...signed, alg: "none" }).success).toBe(false)
  })

  it.each([
    ["another version", { ...planDocument, version: 2 }],
    ["a zero serial", { ...planDocument, serial: 0 }],
    ["a fractional serial", { ...planDocument, serial: 1.5 }],
    ["an unsafe serial", { ...planDocument, serial: 2 ** 53 }],
    ["an unknown status", { ...planDocument, status: "paused" }],
    ["a time with an offset", { ...planDocument, issued_at: "2026-11-10T12:00:00+03:00" }],
    ["a tenant id of another kind", { ...planDocument, tenant_id: "pkg_01J" }],
    ["a missing limit", { ...planDocument, limits: { ...planDocument.limits, staff: undefined } }],
    ["a negative limit", { ...planDocument, limits: { ...planDocument.limits, staff: -1 } }],
    ["a flag that is not a key", { ...planDocument, platform_flags: { "Not A Key": true } }],
    ["a flag that is not a boolean", { ...planDocument, platform_flags: { "a.b": "yes" } }],
    [
      "another currency",
      { ...planDocument, billing: { ...planDocument.billing, currency: "EUR" } },
    ],
  ])("refuses %s", (_case, document) => {
    expect(planDocumentSchema.safeParse(document).success).toBe(false)
  })

  it("takes a billing summary with and without the package name and instruction (Ek C16)", () => {
    const full = {
      ...planDocument,
      billing: {
        ...planDocument.billing,
        package_name: "Profesyonel Ağ",
        payment_instruction: "Alıcı: Quant Dijital\nIBAN: TR00 0000",
      },
    }
    const blank = {
      ...planDocument,
      billing: { ...planDocument.billing, package_name: "Başlangıç", payment_instruction: null },
    }

    expect(planDocumentSchema.parse(full)).toEqual(full)
    expect(planDocumentSchema.parse(blank)).toEqual(blank)
    expect(planDocumentSchema.safeParse(planDocument).success).toBe(true)
  })

  it.each([
    ["an empty package name", { package_name: "" }],
    ["a package name over 100", { package_name: "a".repeat(101) }],
    ["a package name with a line break", { package_name: "a\nb" }],
    ["an instruction with a control character", { payment_instruction: "IBAN\u0007" }],
    ["an instruction with a bidi override", { payment_instruction: "IBAN \u202e" }],
    ["an instruction over 1000", { payment_instruction: "a".repeat(1001) }],
    ["an empty instruction", { payment_instruction: "" }],
  ])("refuses %s", (_case, extra) => {
    const document = { ...planDocument, billing: { ...planDocument.billing, ...extra } }

    expect(planDocumentSchema.safeParse(document).success).toBe(false)
  })

  it("takes null as unlimited", () => {
    const limits = Object.fromEntries(LIMIT_KEYS.map((key) => [key, null]))

    expect(planDocumentSchema.safeParse({ ...planDocument, limits }).success).toBe(true)
  })
})

describe("serial rule", () => {
  it("applies a greater serial, ignores the same, refuses a smaller", () => {
    expect(comparePlanSerial(null, 1)).toBe("newer")
    expect(comparePlanSerial(7, 8)).toBe("newer")
    expect(comparePlanSerial(7, 7)).toBe("same")
    expect(comparePlanSerial(7, 6)).toBe("stale")
  })
})

describe("usage report schema", () => {
  it("accepts the fixture", () => {
    expect(usageReportSchema.parse(usageReport)).toEqual(usageReport)
  })

  it.each([
    ["a sales total", { ...usageReport, revenue: 125000 }],
    ["a customer e-mail", { ...usageReport, counts: { ...usageReport.counts, email: "a@b.co" } }],
    ["a release field", { ...usageReport, release: { ...usageReport.release, branch: "main" } }],
  ])("refuses %s, an unknown field", (_case, report) => {
    const result = usageReportSchema.safeParse(report)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.code).toBe("unrecognized_keys")
  })

  it.each([
    ["another version", { ...usageReport, version: 2 }],
    ["a negative count", { ...usageReport, counts: { ...usageReport.counts, staff: -1 } }],
    [
      "a count past a database integer",
      { ...usageReport, counts: { ...usageReport.counts, products: 2_147_483_648 } },
    ],
    ["a month out of range", { ...usageReport, period: "2026-13" }],
    ["a bad commit", { ...usageReport, release: { ...usageReport.release, commit: "HEAD" } }],
  ])("refuses %s", (_case, report) => {
    expect(usageReportSchema.safeParse(report).success).toBe(false)
  })

  it("names the period by the month in Turkey (UTC+3), Ek C13", () => {
    expect(usagePeriodOf(new Date("2026-10-31T20:59:59.999Z"))).toBe("2026-10")
    expect(usagePeriodOf(new Date("2026-10-31T21:00:00.000Z"))).toBe("2026-11")
    expect(usagePeriodOf(new Date("2026-12-31T21:00:00.000Z"))).toBe("2027-01")
  })
})

describe("signed request headers schema", () => {
  const headers = {
    [SIGNED_REQUEST_HEADERS.tenant]: "ten_01J",
    [SIGNED_REQUEST_HEADERS.keyId]: "0123456789abcdef",
    [SIGNED_REQUEST_HEADERS.timestamp]: "1794301200",
    [SIGNED_REQUEST_HEADERS.nonce]: "AAECAwQFBgcICQoLDA0ODw",
    [SIGNED_REQUEST_HEADERS.signature]: SIGNATURE,
  }

  it("accepts well-formed values and refuses others", () => {
    expect(signedRequestHeadersSchema.safeParse(headers).success).toBe(true)
    expect(
      signedRequestHeadersSchema.safeParse({ ...headers, [SIGNED_REQUEST_HEADERS.nonce]: "x" })
        .success
    ).toBe(false)
    expect(signedRequestHeadersSchema.safeParse({ ...headers, "x-qt-extra": "1" }).success).toBe(
      false
    )
  })
})

describe("registries", () => {
  it("lets a shop move only as adr/0061 §2 says", () => {
    expect(canTransitionTenant("provisioning", "active")).toBe(true)
    expect(canTransitionTenant("active", "restricted")).toBe(true)
    expect(canTransitionTenant("restricted", "active")).toBe(true)
    expect(canTransitionTenant("suspended", "restricted")).toBe(true)
    expect(canTransitionTenant("closing", "closed")).toBe(true)
    expect(canTransitionTenant("provisioning", "suspended")).toBe(false)
    expect(canTransitionTenant("closed", "active")).toBe(false)
    expect(canTransitionTenant("closing", "active")).toBe(false)
  })

  it("names every status and limit", () => {
    expect(Object.keys(TENANT_STATUS_TRANSITIONS).sort()).toEqual([...TENANT_STATUSES].sort())
    expect(Object.keys(LIMIT_REGISTRY).sort()).toEqual([...LIMIT_KEYS].sort())
    // Orders are never blocked (adr/0061 §5.3)
    expect(LIMIT_REGISTRY.orders_per_month.enforcement).toBe("warn")
  })
})
