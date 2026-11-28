import { usageSetupSchema } from "@qticaret/types/control-plane"
import { readSetupFacts, setupFactsOf } from "../setup-facts"
import type { SetupReads } from "../setup-facts"

const REQUIRED = ["distance_sales", "pre_information", "privacy_notice", "return_policy"]

const fresh: SetupReads = {
  storeName: "Medusa Store",
  hasDefaultCurrency: false,
  regions: 0,
  locations: 0,
  shippingOptions: 0,
  paymentConnected: false,
  publishedProducts: 0,
  lookPublished: false,
  publishedLegalKinds: [],
  mailSender: false,
}

describe("setupFactsOf (adr/0061 Ek C21)", () => {
  it("says no to every step of a shop just installed", () => {
    const facts = setupFactsOf(fresh)
    expect(usageSetupSchema.parse(facts)).toEqual(facts)
    expect(Object.values(facts).every((value) => !value)).toBe(true)
  })

  it("follows the shop panel's rules: a real name, one of each, every required text", () => {
    const facts = setupFactsOf({
      storeName: "  Atölye Bıçak ",
      hasDefaultCurrency: true,
      regions: 1,
      locations: 2,
      shippingOptions: 3,
      paymentConnected: true,
      publishedProducts: 12,
      lookPublished: true,
      publishedLegalKinds: [...REQUIRED, "cookie_policy"],
      mailSender: true,
    })
    expect(Object.values(facts).every(Boolean)).toBe(true)
    // Only booleans leave: no name, no count
    expect(JSON.stringify(facts)).not.toMatch(/Atölye|12/)
  })

  it("keeps a blank name and a missing legal text as not done", () => {
    expect(setupFactsOf({ ...fresh, storeName: "   " }).store_named).toBe(false)
    expect(setupFactsOf({ ...fresh, storeName: null }).store_named).toBe(false)
    expect(setupFactsOf({ ...fresh, publishedLegalKinds: REQUIRED.slice(1) }).legal_published).toBe(
      false
    )
  })
})

describe("readSetupFacts", () => {
  it("reads one row or one count each, card providers and SMTP by their check state only", async () => {
    const asked: unknown[] = []
    const calls: Record<string, unknown[]> = {}
    const count =
      (name: string, n: number) =>
      (...args: unknown[]) => {
        calls[name] = args
        return Promise.resolve([[], n])
      }
    const services: Record<string, unknown> = {
      query: {
        graph: () =>
          Promise.resolve({
            data: [{ name: "Atölye", supported_currencies: [{ is_default: true }] }],
          }),
      },
      region: { listAndCountRegions: count("region", 1) },
      stock_location: { listAndCountStockLocations: count("location", 0) },
      fulfillment: { listAndCountShippingOptions: count("shipping", 2) },
      product: { listAndCountProducts: count("product", 0) },
      integrationCredentials: {
        listIntegrationCredentials: (...args: unknown[]) => {
          asked.push(...args)
          return Promise.resolve([
            { provider: "iyzico", verification: "unverified" },
            { provider: "smtp", verification: "rejected" },
          ])
        },
        read: (provider: string) => Promise.resolve({ provider }),
      },
      storefront_layout: { listStorefrontLayouts: () => Promise.resolve([{ id: "sfl_1" }]) },
      legal: {
        listLegalDocuments: () => Promise.resolve(REQUIRED.map((kind) => ({ kind }))),
      },
    }
    const container = { resolve: (key: string) => services[key] } as never

    expect(await readSetupFacts(container)).toEqual({
      store_named: true,
      currency: true,
      region: true,
      stock_location: false,
      shipping: true,
      payment: true,
      product_published: false,
      look_published: true,
      legal_published: true,
      mail_sender: false,
    })
    // The rows' check state, and whether the providers' own cached account opens
    expect(asked).toEqual([
      { provider: ["paytr", "iyzico", "smtp"] },
      { select: ["provider", "verification"], take: 3 },
    ])
    expect(calls["product"]).toEqual([{ status: "published" }, { select: ["id"], take: 1 }])
  })

  it("does not count an account this server cannot open, as the panel does not", async () => {
    const services: Record<string, unknown> = {
      query: { graph: () => Promise.resolve({ data: [] }) },
      region: { listAndCountRegions: () => Promise.resolve([[], 0]) },
      stock_location: { listAndCountStockLocations: () => Promise.resolve([[], 0]) },
      fulfillment: { listAndCountShippingOptions: () => Promise.resolve([[], 0]) },
      product: { listAndCountProducts: () => Promise.resolve([[], 0]) },
      integrationCredentials: {
        listIntegrationCredentials: () =>
          Promise.resolve([
            { provider: "paytr", verification: "verified" },
            { provider: "smtp", verification: "verified" },
          ]),
        // PayTR's sealed secrets do not open here (a removed key); SMTP's do
        read: (provider: string) => Promise.resolve(provider === "smtp" ? { provider } : null),
      },
      storefront_layout: { listStorefrontLayouts: () => Promise.resolve([]) },
      legal: { listLegalDocuments: () => Promise.resolve([]) },
    }
    const facts = await readSetupFacts({ resolve: (key: string) => services[key] } as never)
    expect([facts.payment, facts.mail_sender]).toEqual([false, true])
  })
})
