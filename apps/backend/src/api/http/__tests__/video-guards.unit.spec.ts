import type { MedusaRequest } from "@medusajs/framework/http"
import { logger } from "../../../lib/logging"
import { rejectStoreVideoFields, restrictAdminVideoFields } from "../media-routes"
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
    "+media_videos.id",
    "media_videos.*",
    "+media_videos.outputs",
    "items.product.media_videos.id",
    "+MEDIA_VIDEOS.id",
    "id,title,+media_video.id",
  ])("gives the storefront none: %s", (fields) => {
    const result = run(rejectStoreVideoFields, withFields("/store/products", fields))
    expect(result.status()).toBe(400)
    expect(result.next).not.toHaveBeenCalled()
  })

  it("leaves the storefront's other fields alone", () => {
    const result = run(rejectStoreVideoFields, withFields("/store/products", "+media_assets.url"))
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

  it("gives the admin API the panel's own leaves", () => {
    const fields = "+media_videos.id,+media_videos.status,+media_videos.poster,+media_videos.title"
    const result = run(restrictAdminVideoFields, withFields("/admin/products/prod_1", fields))
    expect(result.next).toHaveBeenCalled()
  })
})

describe("a video upload's body (security review O2)", () => {
  const upload = (headers: Record<string, string>) =>
    request({ path: "/admin/products/prod_1/videos", method: "POST", headers })

  it("takes a multipart form of declared length", () => {
    const result = run(
      requireVideoForm,
      upload({ "content-type": "multipart/form-data; boundary=x", "content-length": "1024" })
    )
    expect(result.next).toHaveBeenCalled()
  })

  it.each([
    ["application/x-www-form-urlencoded", 415],
    ["application/json", 415],
    ["multipart/mixed; boundary=x", 415],
    ["video/mp4", 415],
  ])("refuses %s with %s before reading it", (type, status) => {
    const result = run(requireVideoForm, upload({ "content-type": type, "content-length": "10" }))
    expect(result.status()).toBe(status)
    expect(result.next).not.toHaveBeenCalled()
  })

  it("refuses a body of unknown length", () => {
    const result = run(
      requireVideoForm,
      upload({ "content-type": "multipart/form-data; boundary=x", "transfer-encoding": "chunked" })
    )
    expect(result.status()).toBe(411)
  })
})
