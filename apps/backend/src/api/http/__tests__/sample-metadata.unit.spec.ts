import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SAMPLE_METADATA_ROUTES, refuseSampleMetadata } from "../sample-metadata"

/**
 * The sample catalogue's marks are the server's (security review
 * 2026-11-28, D1): Medusa's product and category routes refuse a body that
 * sets or removes one, one by one or in a batch.
 */
const run = (method: string, body: unknown) => {
  const next = jest.fn<undefined, [unknown?]>()
  refuseSampleMetadata({ method, body } as MedusaRequest, {} as MedusaResponse, next)
  return next.mock.calls[0]?.[0] as { safeMessage?: string } | undefined
}

describe("refuseSampleMetadata", () => {
  it.each([
    ["a create or update", { title: "x", metadata: { sample: "travel@1" } }],
    ["the id a sample names itself by", { metadata: { sample_of: "prod_1" } }],
    ["a removal (Medusa deletes a key sent empty)", { metadata: { sample_at: "" } }],
    ["the job a half made record names", { metadata: { sample_job: "job_1" } }],
    ["a category the samples opened", { metadata: { sample_opened: "travel@1" } }],
    ["a batch's create", { create: [{ title: "x", metadata: { sample: "travel@1" } }] }],
    ["a batch's update", { update: [{ id: "prod_1", metadata: { sample_of: "prod_1" } }] }],
  ])("refuses %s", (_name, body) => {
    expect(run("POST", body)).toMatchObject({ safeMessage: "sample_catalog.metadata_reserved" })
  })

  it("lets the shop's own metadata, reads and empty bodies through", () => {
    expect(run("POST", { metadata: { color: "red", samples: 2 } })).toBeUndefined()
    expect(run("POST", { metadata: null })).toBeUndefined()
    expect(
      run("POST", { create: [{ title: "x" }], update: "nope", delete: ["prod_1"] })
    ).toBeUndefined()
    expect(run("POST", undefined)).toBeUndefined()
    expect(run("GET", { metadata: { sample: "travel@1" } })).toBeUndefined()
  })

  it("is mounted on Medusa's product and category routes and every path below them", () => {
    expect(SAMPLE_METADATA_ROUTES).toEqual([
      { matcher: "/admin/products", middlewares: [refuseSampleMetadata] },
      { matcher: "/admin/product-categories", middlewares: [refuseSampleMetadata] },
    ])
  })
})
