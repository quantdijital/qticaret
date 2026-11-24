import type { MedusaRequest } from "@medusajs/framework/http"
import { logger } from "../../../lib/logging"
import { fakeResponse } from "../../http/__tests__/fakes"
import { rejectRequest } from "../../http/reject"
import {
  asksCollection,
  refuseOffCollectionSeo,
  rejectOffCollectionReads,
} from "../collection-reads"

// The refusal's own answer (headers, request id) is the error handler's, tested there
jest.mock("../../http/reject", () => ({
  ...jest.requireActual<object>("../../http/reject"),
  rejectRequest: jest.fn(),
}))

const reject = rejectRequest as jest.MockedFunction<typeof rejectRequest>

const scope = (enabled: boolean) => ({
  resolve: () => ({ isFeatureEnabled: jest.fn(() => Promise.resolve(enabled)) }),
})

const storeRequest = (query: Record<string, unknown>, enabled: boolean) =>
  ({
    method: "GET",
    originalUrl: "/store/products",
    requestId: "req-12345678",
    query,
    scope: scope(enabled),
  }) as unknown as MedusaRequest

const seoRequest = (path: string, params: Record<string, string>, enabled: boolean) =>
  ({
    method: "PUT",
    originalUrl: path,
    requestId: "req-12345678",
    params,
    scope: scope(enabled),
  }) as unknown as MedusaRequest

beforeEach(() => {
  jest.spyOn(logger, "info").mockImplementation(() => undefined)
  jest.spyOn(logger, "warn").mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("asksCollection", () => {
  it.each([
    [{ fields: "*collection" }],
    [{ fields: "id,+collection.title" }],
    [{ fields: ["title", "collection_id"] }],
    [{ fields: "items.product.collection" }],
    [{ collection_id: "pcol_1" }],
    [{ collection_id: ["pcol_1"] }],
  ])("sees a product's collection in %j", (query) => {
    expect(asksCollection(query)).toBe(true)
  })

  it.each([
    [{}],
    [{ fields: "id,title,*variants" }],
    [{ fields: "payment_collection.id" }],
    [{ fields: "collections_note" }],
  ])("lets %j through", (query) => {
    expect(asksCollection(query)).toBe(false)
  })
})

describe("rejectOffCollectionReads", () => {
  it("refuses a collection field or filter while collections are off", async () => {
    reject.mockClear()
    const next = jest.fn()

    await rejectOffCollectionReads(
      storeRequest({ collection_id: "pcol_1" }, false),
      fakeResponse().res,
      next
    )

    expect(next).not.toHaveBeenCalled()
    expect(reject.mock.calls[0]?.[2]).toBe(400)
    expect(reject.mock.calls[0]?.[4]).toBe("store_collection_off")
  })

  it("lets it through while on, and other reads while off", async () => {
    const on = jest.fn()
    const other = jest.fn()

    await rejectOffCollectionReads(
      storeRequest({ fields: "*collection" }, true),
      fakeResponse().res,
      on
    )
    await rejectOffCollectionReads(storeRequest({ fields: "id" }, false), fakeResponse().res, other)

    expect(on).toHaveBeenCalled()
    expect(other).toHaveBeenCalled()
  })
})

describe("refuseOffCollectionSeo", () => {
  it("answers a collection's SEO write as a missing route while off", async () => {
    const response = fakeResponse()
    const next = jest.fn()

    await refuseOffCollectionSeo("meta")(
      seoRequest("/admin/seo/collection/pcol_1", { entity_type: "collection" }, false),
      response.res,
      next
    )

    expect(next).not.toHaveBeenCalled()
    expect(response.status()).toBe(404)
    expect(response.body()).toContain("Cannot PUT /admin/seo/collection/pcol_1")
  })

  it("reads the type from the path when the middleware sees no parameters", async () => {
    const response = fakeResponse()
    const next = jest.fn()

    await refuseOffCollectionSeo("fix")(
      seoRequest("/admin/seo/assessments/collection/pcol_1/fix", {}, false),
      response.res,
      next
    )

    expect(next).not.toHaveBeenCalled()
    expect(response.status()).toBe(404)
  })

  it("lets a collection through while on, and another type while off", async () => {
    const on = jest.fn()
    const product = jest.fn()

    await refuseOffCollectionSeo("meta")(
      seoRequest("/admin/seo/collection/pcol_1", { entity_type: "collection" }, true),
      fakeResponse().res,
      on
    )
    await refuseOffCollectionSeo("fix")(
      seoRequest("/admin/seo/assessments/product/prod_1/fix", { kind: "product" }, false),
      fakeResponse().res,
      product
    )

    expect(on).toHaveBeenCalled()
    expect(product).toHaveBeenCalled()
  })
})
