import {
  MemoryNonceStore,
  privateKeyFromSeed,
  rawPublicKey,
  signerFromPrivateKey,
  verifySignedRequest,
} from "@qticaret/server-kit"
import { usageReportSchema } from "@qticaret/types/control-plane"
import {
  TENANT_ID,
  TEST_ONLY_CP_SEED,
  TEST_ONLY_TENANT_SEED,
} from "@qticaret/types/control-plane/testing"
import { USAGE_PATH, sendUsageReport } from "../report"

const cp = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_CP_SEED))
const shop = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_TENANT_SEED))
const release = { version: "1.0.0", commit: "abcdef0" }

const MANAGED: Record<string, string> = {
  CONTROL_PLANE_PUBLIC_KEYS: rawPublicKey(cp.privateKey).toString("base64url"),
  TENANT_ID,
  TENANT_SIGNING_KEY: TEST_ONLY_TENANT_SEED.toString("base64url"),
  CONTROL_PLANE_URL: "http://cp.internal:9100",
}

const services: Record<string, unknown> = {
  query: {
    graph: () => Promise.resolve({ data: [], metadata: { count: 0 } }),
  },
  product: { listAndCountProducts: () => Promise.resolve([[], 2]) },
  user: { listAndCountUsers: () => Promise.resolve([[], 1]) },
  media: { storedBytes: () => Promise.resolve(0) },
  content_drafts: { usedIn: () => Promise.resolve(0) },
}
const container = { resolve: (key: string) => services[key] } as never

interface Sent {
  url: string
  init: RequestInit
}

function fakeFetch(status: number | Error, answer: unknown = {}) {
  const sent: Sent[] = []
  const fetch = (url: string, init: RequestInit) => {
    sent.push({ url, init })
    return status instanceof Error
      ? Promise.reject(status)
      : Promise.resolve(new Response(JSON.stringify(answer), { status }))
  }
  return { sent, fetch }
}

describe("sendUsageReport (adr/0061 §5.4, Ek C13)", () => {
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const [name, value] of Object.entries(MANAGED)) {
      saved[name] = process.env[name]
      process.env[name] = value
    }
  })
  afterEach(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name)
      } else {
        process.env[name] = value
      }
    }
  })

  it("posts the report once, signed over its exact bytes, following no redirect", async () => {
    const { sent, fetch } = fakeFetch(200)
    expect(await sendUsageReport(container, { fetch, release })).toEqual({ outcome: "sent" })
    expect(sent).toHaveLength(1)
    const [{ url, init }] = sent as [Sent]
    expect(url).toBe(`http://cp.internal:9100${USAGE_PATH}`)
    expect(init.method).toBe("POST")
    expect(init.redirect).toBe("error")
    expect(init.signal).toBeInstanceOf(AbortSignal)
    const body = init.body as string
    expect(usageReportSchema.parse(JSON.parse(body))).toMatchObject({
      tenant_id: TENANT_ID,
      counts: { products: 2, staff: 1 },
      release,
    })
    const verified = await verifySignedRequest(
      { method: "POST", path: USAGE_PATH, headers: init.headers as Record<string, string>, body },
      {
        publicKey: (kid, tenant) =>
          kid === shop.kid && tenant === TENANT_ID ? shop.privateKey : undefined,
        nonces: new MemoryNonceStore(),
      }
    )
    expect(verified).toMatchObject({ ok: true, tenantId: TENANT_ID })
    // Another body under the same headers fails: the signature covers the bytes
    const changed = await verifySignedRequest(
      {
        method: "POST",
        path: USAGE_PATH,
        headers: init.headers as Record<string, string>,
        body: body.replace('"products":2', '"products":3'),
      },
      { publicKey: () => shop.privateKey, nonces: new MemoryNonceStore() }
    )
    expect(changed).toEqual({ ok: false, code: "signature.invalid" })
  })

  it("carries the setup checklist when it reads, and the counts without it when not (Ek C21)", async () => {
    const withSetup: Record<string, unknown> = {
      ...services,
      region: { listAndCountRegions: () => Promise.resolve([[], 1]) },
      stock_location: { listAndCountStockLocations: () => Promise.resolve([[], 1]) },
      fulfillment: { listAndCountShippingOptions: () => Promise.resolve([[], 0]) },
      integrationCredentials: {
        listIntegrationCredentials: () => Promise.resolve([]),
        read: () => Promise.resolve(null),
      },
      storefront_layout: { listStorefrontLayouts: () => Promise.resolve([]) },
      legal: { listLegalDocuments: () => Promise.resolve([]) },
    }
    const full = fakeFetch(200)
    const resolver = { resolve: (key: string) => withSetup[key] } as never
    expect(await sendUsageReport(resolver, { fetch: full.fetch, release })).toEqual({
      outcome: "sent",
    })
    const sentReport = usageReportSchema.parse(JSON.parse(full.sent[0]?.init.body as string))
    expect(sentReport.setup).toMatchObject({ region: true, shipping: false, payment: false })
    // The base container has no region service: the setup read fails, the counts still go
    const bare = fakeFetch(200)
    expect(await sendUsageReport(container, { fetch: bare.fetch, release })).toEqual({
      outcome: "sent",
    })
    expect(JSON.parse(bare.sent[0]?.init.body as string)).not.toHaveProperty("setup")
    // A read that hangs is given up on: the counts go without the checklist (review L2)
    const never = new Promise<never>(() => undefined)
    const hanging: Record<string, unknown> = {
      ...withSetup,
      region: { listAndCountRegions: () => never },
    }
    const slow = fakeFetch(200)
    const slowResolver = { resolve: (key: string) => hanging[key] } as never
    expect(
      await sendUsageReport(slowResolver, { fetch: slow.fetch, release, setupTimeoutMs: 20 })
    ).toEqual({ outcome: "sent" })
    expect(JSON.parse(slow.sent[0]?.init.body as string)).not.toHaveProperty("setup")
  })

  it("sends the counts once more without the checklist when an older control plane refuses it (Ek C21 L4)", async () => {
    const withSetup: Record<string, unknown> = {
      ...services,
      region: { listAndCountRegions: () => Promise.resolve([[], 1]) },
      stock_location: { listAndCountStockLocations: () => Promise.resolve([[], 1]) },
      fulfillment: { listAndCountShippingOptions: () => Promise.resolve([[], 0]) },
      integrationCredentials: {
        listIntegrationCredentials: () => Promise.resolve([]),
        read: () => Promise.resolve(null),
      },
      storefront_layout: { listStorefrontLayouts: () => Promise.resolve([]) },
      legal: { listLegalDocuments: () => Promise.resolve([]) },
    }
    const resolver = { resolve: (key: string) => withSetup[key] } as never
    const sent: Sent[] = []
    const oldControlPlane = (url: string, init: RequestInit) => {
      sent.push({ url, init })
      const hasSetup = (init.body as string).includes('"setup"')
      return Promise.resolve(
        hasSetup
          ? new Response(JSON.stringify({ message: "usage.invalid" }), { status: 400 })
          : new Response("{}", { status: 200 })
      )
    }
    expect(await sendUsageReport(resolver, { fetch: oldControlPlane, release })).toEqual({
      outcome: "sent",
    })
    expect(sent).toHaveLength(2)
    expect(JSON.parse(sent[1]?.init.body as string)).not.toHaveProperty("setup")
    // Two signed requests, two nonces
    const nonce = (each: Sent | undefined) =>
      Object.entries(each?.init.headers as Record<string, string>).find(([name]) =>
        name.toLowerCase().includes("nonce")
      )?.[1]
    expect(nonce(sent[0])).toBeDefined()
    expect(nonce(sent[0])).not.toBe(nonce(sent[1]))
    // Without a checklist a refusal is final: no second request
    const plain = fakeFetch(400, { message: "usage.invalid" })
    expect(await sendUsageReport(container, { fetch: plain.fetch, release })).toEqual({
      outcome: "refused",
      status: 400,
    })
    expect(plain.sent).toHaveLength(1)
  })

  it("tries once and says why when refused or unreachable; the next hour is the retry", async () => {
    const refused = fakeFetch(409)
    expect(await sendUsageReport(container, { fetch: refused.fetch, release })).toEqual({
      outcome: "refused",
      status: 409,
    })
    expect(refused.sent).toHaveLength(1)
    // Review M1: a report minutes after the last is no failure, only said
    const soon = fakeFetch(409, { type: "conflict", message: "usage.too_soon" })
    expect(await sendUsageReport(container, { fetch: soon.fetch, release })).toEqual({
      outcome: "too_soon",
    })
    const order = fakeFetch(409, { type: "conflict", message: "usage.out_of_order" })
    expect(await sendUsageReport(container, { fetch: order.fetch, release })).toEqual({
      outcome: "refused",
      status: 409,
    })
    const down = fakeFetch(new TypeError("fetch failed"))
    expect(await sendUsageReport(container, { fetch: down.fetch, release })).toEqual({
      outcome: "unreachable",
    })
    expect(down.sent).toHaveLength(1)
    const failing = { resolve: () => ({}) } as never
    const quiet = fakeFetch(200)
    expect(await sendUsageReport(failing, { fetch: quiet.fetch, release })).toEqual({
      outcome: "count_failed",
    })
    expect(quiet.sent).toHaveLength(0)
  })

  it("sends nothing unmanaged, or without the control plane's address", async () => {
    const { sent, fetch } = fakeFetch(200)
    Reflect.deleteProperty(process.env, "CONTROL_PLANE_URL")
    Reflect.deleteProperty(process.env, "TENANT_SIGNING_KEY")
    expect(await sendUsageReport(container, { fetch, release })).toEqual({
      outcome: "not_configured",
    })
    Reflect.deleteProperty(process.env, "CONTROL_PLANE_PUBLIC_KEYS")
    expect(await sendUsageReport(container, { fetch, release })).toEqual({ outcome: "unmanaged" })
    expect(sent).toHaveLength(0)
  })
})
