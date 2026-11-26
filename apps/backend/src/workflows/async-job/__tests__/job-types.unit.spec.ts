import {
  JOB_TYPE_KEYS,
  MANAGER_JOB_TYPES,
  PLATFORM_JOB_TYPES,
  SCHEDULED_JOB_TYPES,
  exclusiveTypes,
  jobType,
  queueLockKey,
} from "../types"

// The audit reads redirects, and the publish gate (an import's, a bulk
// edit's) assesses products, through module links, which need a running
// app to define; the registry's own facts do not
jest.mock("../../seo/audit", () => ({ runSeoAudit: jest.fn() }))
jest.mock("../../seo/advisor/publish-gate", () => ({ publishGate: jest.fn() }))

describe("job types", () => {
  it("knows its types by own key only", () => {
    expect(JOB_TYPE_KEYS).toEqual([
      "accounting.package",
      "ai.alt_text",
      "ai.image_edit",
      "ai.seo_fill",
      "audit_log.export",
      "catalog.bulk_edit",
      "catalog.description_facts",
      "catalog.export",
      "catalog.import",
      "content.link_rewrite",
      "customer.data_export",
      "customer.export",
      "migration.invites",
      "migration.run",
      "migration.sitemap",
      "migration.urls",
      "order.export",
      "promotion.codes",
      "report.export",
      "seo.audit",
      "seo.sitemap",
      "seo.url_style",
      "tr_address.sync",
      "wholesale.carts",
      "wholesale.sync",
    ])
    expect(jobType("__proto__")).toBeUndefined()
    expect(jobType("constructor")).toBeUndefined()
  })

  it("marks the audit log export as a single, personal data job kept 7 days", () => {
    expect(jobType("audit_log.export")).toMatchObject({
      singleton: true,
      containsPersonalData: true,
      resultTtlDays: 7,
    })
  })

  it.each(["order.export", "customer.export"])(
    "keeps the %s the owner's: queued by its own route, personal data",
    (type) => {
      expect(jobType(type)).toMatchObject({
        internal: true,
        ownerOnly: true,
        containsPersonalData: true,
        resultTtlDays: 7,
      })
    }
  )

  it("keeps the order export the owner's: queued by its own route, personal data", () => {
    expect(jobType("order.export")).toMatchObject({
      internal: true,
      ownerOnly: true,
      containsPersonalData: true,
      resultTtlDays: 7,
    })
  })

  it("writes wholesale prices one run at a time, queued by its own code, seen by managers (L4)", () => {
    expect(jobType("wholesale.sync")).toMatchObject({
      singleton: true,
      internal: true,
      managersOnly: true,
      containsPersonalData: false,
    })
    // Review M2: the carts repriced when the flag turns, likewise
    expect(jobType("wholesale.carts")).toMatchObject({
      singleton: true,
      internal: true,
      managersOnly: true,
      containsPersonalData: false,
    })
    // Aşama 4: a background edit job, queued by its route and seen by the owner and admin
    expect(jobType("ai.image_edit")).toMatchObject({
      singleton: true,
      internal: true,
      managersOnly: true,
      containsPersonalData: false,
    })
    expect(MANAGER_JOB_TYPES).toEqual([
      "ai.image_edit",
      "ai.seo_fill",
      "wholesale.carts",
      "wholesale.sync",
    ])
  })

  it("syncs the address data one run at a time, never through the jobs route", () => {
    expect(jobType("tr_address.sync")).toMatchObject({
      singleton: true,
      internal: true,
      platform: true,
      containsPersonalData: false,
    })
    // The platform's own upkeep: the only kind no one in the shop asks for (docs/06 principle 10)
    expect(PLATFORM_JOB_TYPES).toEqual(["tr_address.sync"])
    // Its schedule also runs these, which staff start too: only staff's runs are the shop's to see
    expect(SCHEDULED_JOB_TYPES).toEqual(["seo.audit", "seo.sitemap"])
    expect(jobType("tr_address.sync")?.input.safeParse({}).success).toBe(true)
    expect(jobType("tr_address.sync")?.input.safeParse({ source: "file" }).success).toBe(false)
  })

  it("moves URL styles one run at a time, with nothing personal", () => {
    const type = jobType("seo.url_style")
    expect(type).toMatchObject({ singleton: true, containsPersonalData: false })
    expect(
      type?.input.safeParse({ product: "flat", category: "prefixed", brand: "prefixed" }).success
    ).toBe(true)
    expect(type?.input.safeParse({ product: "short" }).success).toBe(false)
  })

  it("audits the store one run at a time, keeping its report a month", () => {
    const type = jobType("seo.audit")
    expect(type).toMatchObject({ singleton: true, containsPersonalData: false, resultTtlDays: 30 })
    expect(type?.input.safeParse({ deep: true }).success).toBe(false)
  })

  it("edits products in bulk one run at a time, through the generic jobs route", () => {
    const type = jobType("catalog.bulk_edit")
    expect(type).toMatchObject({ singleton: true, containsPersonalData: false, resultTtlDays: 7 })
    expect(type?.internal).toBeUndefined()
    // Never beside an import: both write products
    expect(exclusiveTypes("catalog.bulk_edit")).toEqual([
      "catalog.bulk_edit",
      "catalog.description_facts",
      "catalog.import",
      "content.link_rewrite",
      "migration.run",
      "migration.sitemap",
      "migration.urls",
    ])
    expect(queueLockKey("catalog.import")).toBe(queueLockKey("catalog.bulk_edit"))
    expect(exclusiveTypes("seo.audit")).toEqual(["seo.audit"])
    expect(
      type?.input.safeParse({
        product_ids: ["prod_1"],
        change: { action: "price", mode: "percent", value: 10 },
      }).success
    ).toBe(true)
  })

  it("writes the facts in descriptions as a catalog write, through the generic jobs route", () => {
    const type = jobType("catalog.description_facts")
    expect(type).toMatchObject({ singleton: true, containsPersonalData: false, resultTtlDays: 7 })
    expect(type?.internal).toBeUndefined()
    expect(queueLockKey("catalog.description_facts")).toBe(queueLockKey("catalog.import"))
    const parsed = type?.input.safeParse({ product_ids: ["prod_1"] })
    expect(parsed?.data).toEqual({
      product_ids: ["prod_1"],
      overwrite: false,
      fields: [],
      aliases: [],
    })
    expect(type?.input.safeParse({ product_ids: ["prod_1", "prod_1"] }).success).toBe(false)
    expect(
      type?.input.safeParse({ product_ids: ["prod_1"], fields: [{ label: "x" }] }).success
    ).toBe(false)
  })

  it("rewrites the texts' links as a catalog write, owner and admin through the jobs route", () => {
    const type = jobType("content.link_rewrite")
    expect(type).toMatchObject({ singleton: true, containsPersonalData: false, resultTtlDays: 7 })
    expect(type?.internal).toBeUndefined()
    expect(type?.ownerOnly).toBeUndefined()
    expect(queueLockKey("content.link_rewrite")).toBe(queueLockKey("migration.run"))
    expect(type?.input.safeParse({}).data).toEqual({ dry_run: false, hosts: [] })
    expect(type?.input.safeParse({ hosts: [" WWW.Eski-Site.com "] }).data).toEqual({
      dry_run: false,
      hosts: ["www.eski-site.com"],
    })
    for (const wrong of [
      { hosts: ["https://eski.com"] },
      { hosts: ["eski"] },
      { hosts: Array(6).fill("eski.com") },
      { dry_run: "yes" },
      { scope: { entries: [] } },
    ]) {
      expect(type?.input.safeParse(wrong).success).toBe(false)
    }
  })

  it.each([
    [{}, true],
    [{ kind: "mutation", created_after: "2026-10-01T00:00:00.000Z" }, true],
    [{ kind: "everything" }, false],
    [{ created_after: "yesterday" }, false],
    [{ ip: "203.0.113.7" }, false],
  ])("checks export filters %p", (input, valid) => {
    expect(jobType("audit_log.export")?.input.safeParse(input).success).toBe(valid)
  })
})
