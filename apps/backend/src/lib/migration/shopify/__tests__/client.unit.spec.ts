import { randomBytes } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { DEMO_SHOPIFY, startFakeShopify } from "@qticaret/testing"
import type { FakeShopify } from "@qticaret/testing"
import { bulkNodes } from "../bulk"
import { checkShopify, createShopifyApi } from "../client"

const app = { clientId: "unit-shopify-app-0001", clientSecret: randomBytes(16).toString("hex") }
const credentials = {
  shopDomain: "demo.myshopify.com",
  clientId: app.clientId,
  clientSecret: app.clientSecret,
}
const noWait = () => Promise.resolve()

describe("Shopify's Admin API (F14.2)", () => {
  let fake: FakeShopify

  beforeAll(async () => {
    fake = await startFakeShopify(app, { data: structuredClone(DEMO_SHOPIFY) })
  })

  afterAll(async () => {
    await fake.close()
  })

  it("tells the account's faults from each other", async () => {
    const signal = AbortSignal.timeout(5_000)
    expect(await checkShopify(credentials, signal, fake.url)).toBe("valid")
    expect(
      await checkShopify({ ...credentials, clientSecret: "yanlis-gizli" }, signal, fake.url)
    ).toBe("secret_invalid")
    fake.refuseShop(true)
    expect(await checkShopify(credentials, signal, fake.url)).toBe("merchant_invalid")
    fake.refuseShop(false)
  })

  it("buys a day's token once and waits out a throttled call", async () => {
    const waits: number[] = []
    const api = createShopifyApi(credentials, {
      origin: fake.url,
      sleep: (ms) => {
        waits.push(ms)
        return Promise.resolve()
      },
    })
    const first = await api.token()
    fake.throttle(2)
    const shop = await api.graphql(
      "{ shop { currencyCode } }",
      {},
      z.object({ shop: z.object({ currencyCode: z.string() }) }),
      { read: true }
    )
    expect(shop.shop.currencyCode).toBe("TRY")
    expect(await api.token()).toBe(first)
    expect(waits).toEqual([1_000, 1_000])
  })

  it("runs a bulk query to its file, beating while Shopify works", async () => {
    const api = createShopifyApi(credentials, { origin: fake.url })
    let beats = 0
    const nodes = await bulkNodes(api, "{ products { edges { node { id } } } }", {
      beat: () => {
        beats += 1
        return Promise.resolve()
      },
      sleep: noWait,
      fake: fake.url,
    })
    expect(nodes.filter((node) => !node.__parentId).map((node) => node.id)).toEqual([
      "gid://shopify/Product/1",
      "gid://shopify/Product/2",
    ])
    expect(beats).toBe(2)
    // An empty list leaves no file: none is fetched
    const pages = fake.data.pages
    fake.data.pages = []
    expect(
      await bulkNodes(api, "{ pages { edges { node { id } } } }", {
        beat: noWait,
        sleep: noWait,
        fake: fake.url,
      })
    ).toEqual([])
    fake.data.pages = pages
  })
})
