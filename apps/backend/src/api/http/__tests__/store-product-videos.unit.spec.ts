import type { MedusaRequest } from "@medusajs/framework/http"
import { shopperVideos, storeProductVideos } from "../store-product-videos"
import { fakeResponse } from "./fakes"

const ready = { id: "mvid_1", status: "ready", position: 1 }
const queued = { id: "mvid_2", status: "processing", position: 1 }
const failed = { id: "mvid_3", status: "failed", position: 1 }

function request(fields: string | undefined, on: boolean | Error, method = "GET") {
  return {
    method,
    path: "/store/products/prod_1",
    query: fields === undefined ? {} : { fields },
    scope: {
      resolve: () => ({
        isFeatureEnabled: () => (on instanceof Error ? Promise.reject(on) : Promise.resolve(on)),
      }),
    },
  } as unknown as MedusaRequest
}

async function answer(req: MedusaRequest, body: unknown) {
  const response = fakeResponse()
  const next = jest.fn<undefined, unknown[]>()
  await storeProductVideos(req, response.res, next)
  if (next.mock.calls.length === 1 && next.mock.calls[0]?.length === 0) {
    response.res.json(body)
  }
  return { body: response.body(), next }
}

describe("shopperVideos (adr/0069 §6, §12)", () => {
  it("keeps only the ready videos while the flag is on", () => {
    const product = { id: "prod_1", media_videos: [ready, queued, failed, null] }
    shopperVideos(product, true)
    expect(product.media_videos).toEqual([ready])
  })

  it("shows none asked without their status: none is known to be ready", () => {
    const product = { id: "prod_1", media_videos: [{ id: "mvid_1" }] }
    shopperVideos(product, true)
    expect(product.media_videos).toEqual([])
  })

  it("takes the videos out altogether while the flag is off", () => {
    const product: Record<string, unknown> = { id: "prod_1", media_videos: [ready] }
    shopperVideos(product, false)
    expect(product).not.toHaveProperty("media_videos")
  })

  it("leaves a product that did not ask for them as it is", () => {
    const product = { id: "prod_1", title: "Şef Bıçağı" }
    shopperVideos(product, false)
    expect(product).toEqual({ id: "prod_1", title: "Şef Bıçağı" })
  })
})

describe("storeProductVideos", () => {
  const fields = "id,media_videos.id,media_videos.status"

  it("cuts a product's page and a list down to the ready videos", async () => {
    const page = await answer(request(fields, true), {
      product: { id: "prod_1", media_videos: [ready, queued] },
    })
    expect(page.body).toEqual({ product: { id: "prod_1", media_videos: [ready] } })
    const list = await answer(request(`+${fields}`, true), {
      products: [{ id: "prod_1", media_videos: [failed, ready] }],
    })
    expect(list.body).toEqual({ products: [{ id: "prod_1", media_videos: [ready] }] })
  })

  it("cuts a HEAD's answer down alike: its size tells nothing (review S1)", async () => {
    const on = await answer(request(fields, true, "HEAD"), {
      product: { id: "prod_1", media_videos: [ready, queued] },
    })
    expect(on.body).toEqual({ product: { id: "prod_1", media_videos: [ready] } })
    const off = await answer(request(fields, false, "HEAD"), {
      product: { id: "prod_1", media_videos: [ready] },
    })
    expect(off.body).toEqual({ product: { id: "prod_1" } })
  })

  it("answers without videos while the flag is off, never refusing the request", async () => {
    const page = await answer(request(fields, false), {
      product: { id: "prod_1", media_videos: [ready] },
    })
    expect(page.body).toEqual({ product: { id: "prod_1" } })
  })

  it("does not read the flag for a request that did not ask for videos", async () => {
    const req = request("id,title", new Error("not read"))
    const page = await answer(req, { product: { id: "prod_1" } })
    expect(page.next).toHaveBeenCalledWith()
    expect(page.body).toEqual({ product: { id: "prod_1" } })
  })

  it("passes on a failure to read the flag", async () => {
    const failure = new Error("settings down")
    const result = await answer(request(fields, failure), {})
    expect(result.next).toHaveBeenCalledWith(failure)
  })
})
