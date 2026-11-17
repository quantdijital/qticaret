import { afterEach, describe, expect, it, vi } from "vitest"
import { uploadProductVideo } from "./video-upload"

/** A stand-in request: records what is sent, answers when told. */
class FakeRequest {
  static last: FakeRequest | null = null
  method = ""
  url = ""
  withCredentials = false
  responseType = ""
  status = 0
  responseText = ""
  body: unknown = null
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  constructor() {
    FakeRequest.last = this
  }
  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  send(body: unknown) {
    this.body = body
  }
  abort() {
    this.onabort?.()
  }
  answer(status: number, body: unknown) {
    this.status = status
    this.responseText = JSON.stringify(body)
    this.onload?.()
  }
  progress(loaded: number, total: number, lengthComputable = true) {
    this.upload.onprogress?.({ loaded, total, lengthComputable } as ProgressEvent)
  }
}

describe("uploading a clip with its progress", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts the file as multipart with the session, reporting the share sent", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeRequest)
    const shares: (number | null)[] = []
    const file = new File(["v"], "klip.mp4", { type: "video/mp4" })
    const done = uploadProductVideo("prod_1", file, (share) => shares.push(share))
    const request = FakeRequest.last
    expect(request).toMatchObject({
      method: "POST",
      url: "/admin/products/prod_1/videos",
      withCredentials: true,
    })
    expect((request?.body as FormData).get("file")).toBeInstanceOf(File)
    request?.progress(25, 100)
    request?.progress(0, 0, false)
    request?.answer(202, { video: { id: "mvid_1", status: "uploaded" } })
    await expect(done).resolves.toMatchObject({ id: "mvid_1" })
    expect(shares).toEqual([0, 0.25, null])
  })

  it("rejects with the server's sentence and status, as errorText reads them", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeRequest)
    const done = uploadProductVideo("prod_1", new File(["v"], "a.mp4"), () => undefined)
    FakeRequest.last?.answer(400, {
      message: "Video en çok 30 saniye olabilir.",
      code: "video.too_long",
    })
    await expect(done).rejects.toMatchObject({
      status: 400,
      message: "Video en çok 30 saniye olabilir.",
      code: "video.too_long",
    })
  })
})
