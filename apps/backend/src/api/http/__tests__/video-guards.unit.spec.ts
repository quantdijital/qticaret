import type { MedusaRequest } from "@medusajs/framework/http"
import { logger } from "../../../lib/logging"
import {
  STORE_VIDEO_LEAVES,
  restrictAdminVideoFields,
  restrictStoreVideoFields,
} from "../media-routes"
import { requireVideoForm } from "../video-routes"
import { fakeResponse } from "./fakes"

const request = (fields: {
  path: string
  method?: string
  headers?: Record<string, string>
  query?: Record<string, unknown>
}) =>
  ({
    path: fields.path,
    originalUrl: fields.path,
    method: fields.method ?? "GET",
    headers: fields.headers ?? {},
    query: fields.query ?? {},
    requestId: "req-12345678",
  }) as unknown as MedusaRequest

function run(middleware: typeof requireVideoForm, req: MedusaRequest) {
  const response = fakeResponse()
  const next = jest.fn()
  middleware(req, response.res, next)
  return { ...response, next }
}

beforeEach(() => {
  jest.spyOn(logger, "info").mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("a video's fields through `fields` (adr/0069, security review D3)", () => {
  const withFields = (path: string, fields: string) => request({ path, query: { fields } })

  it.each([
    "*media_videos",
    "media_videos",
    "media_videos.*",
    "+media_videos.source_file_id",
    "+media_videos.output_file_ids",
    "+media_videos.poster_file_ids",
    "+media_videos.error_code",
    "+media_videos.uploaded_by",
    "+media_videos.attempts",
    "+media_videos.retry_from",
    "+media_videos.failed_at",
    "+media_videos.heartbeat_at",
    "+media_videos.stored_bytes",
    "+media_videos.outputs.url",
    "items.product.media_videos.id",
    "+MEDIA_VIDEOS.id",
    "id,title,+media_video.id",
  ])("gives the storefront no key, bookkeeping or whole relation: %s", (fields) => {
    const result = run(restrictStoreVideoFields, withFields("/store/products", fields))
    expect(result.status()).toBe(400)
    expect(result.next).not.toHaveBeenCalled()
  })

  it("gives the storefront the gallery's leaves, named one by one (slice 4)", () => {
    const fields = STORE_VIDEO_LEAVES.map((leaf) => `+${leaf}`).join(",")
    const result = run(restrictStoreVideoFields, withFields("/store/products/prod_1", fields))
    expect(result.next).toHaveBeenCalled()
  })

  it("leaves the storefront's other fields alone", () => {
    const result = run(restrictStoreVideoFields, withFields("/store/products", "+media_assets.url"))
    expect(result.next).toHaveBeenCalled()
  })

  it.each([
    "*media_videos",
    "media_videos",
    "media_videos.*",
    "+media_videos.source_file_id",
    "+media_videos.output_file_ids",
    "+media_videos.poster_file_ids",
    "+media_videos.uploaded_by",
    "+media_videos.heartbeat_at",
    "variants.product.media_videos.id",
  ])("gives the admin API no key, uploader or whole relation: %s", (fields) => {
    const result = run(restrictAdminVideoFields, withFields("/admin/products/prod_1", fields))
    expect(result.status()).toBe(400)
  })

  it.each([
    ["an object", { x: "media_videos" }],
    ["a list holding an object", ["id", { x: "media_videos" }]],
    ["a number", 5],
  ])("refuses `fields` it cannot read: %s (review B-4)", (_, fields) => {
    const req = request({ path: "/admin/products/prod_1", query: { fields } })
    expect(run(restrictAdminVideoFields, req).status()).toBe(400)
    const store = request({ path: "/store/products", query: { fields } })
    expect(run(restrictStoreVideoFields, store).status()).toBe(400)
  })

  it("leaves a request without `fields`, or with a list of strings, to the rules", () => {
    expect(
      run(restrictStoreVideoFields, request({ path: "/store/products" })).next
    ).toHaveBeenCalled()
    const list = request({ path: "/store/products", query: { fields: ["id", "+title"] } })
    expect(run(restrictStoreVideoFields, list).next).toHaveBeenCalled()
  })

  it("gives the admin API the panel's own leaves", () => {
    const fields = "+media_videos.id,+media_videos.status,+media_videos.poster,+media_videos.title"
    const result = run(restrictAdminVideoFields, withFields("/admin/products/prod_1", fields))
    expect(result.next).toHaveBeenCalled()
  })
})

describe("a video upload's body (security review O2)", () => {
  // A request whose body has been read: the refusal waits for a body's drain (drain.ts)
  const upload = (headers: Record<string, string>) =>
    Object.assign(request({ path: "/admin/products/prod_1/videos", method: "POST", headers }), {
      complete: true,
    })

  async function form(req: MedusaRequest) {
    const result = run(requireVideoForm, req)
    await new Promise((resolve) => setImmediate(resolve))
    return result
  }

  it("takes a multipart form of declared length", async () => {
    const result = await form(
      upload({ "content-type": "multipart/form-data; boundary=x", "content-length": "1024" })
    )
    expect(result.next).toHaveBeenCalled()
  })

  it.each([
    ["application/x-www-form-urlencoded", 415],
    ["application/json", 415],
    ["multipart/mixed; boundary=x", 415],
    ["video/mp4", 415],
  ])("refuses %s with %s before reading it", async (type, status) => {
    const result = await form(upload({ "content-type": type, "content-length": "10" }))
    expect(result.status()).toBe(status)
    expect(result.next).not.toHaveBeenCalled()
  })

  it("refuses a body of unknown length", async () => {
    const result = await form(
      upload({ "content-type": "multipart/form-data; boundary=x", "transfer-encoding": "chunked" })
    )
    expect(result.status()).toBe(411)
  })
})
