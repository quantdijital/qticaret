import sharp from "sharp"
import { isProviderError } from "../../errors/errors"
import { DIGITAL_SOURCE_TYPES, digitalSourceTypeOf } from "../../media"
import { SafeFetchError } from "../../security/safe-fetch"
import type { SafeFetchOptions, SafeFetchResponse } from "../../security/safe-fetch"
import type { ImageEditConnector, ImageEditRequest } from "../connectors/image-types"
import { downloadResult } from "../download"
import { FAKE_SERVICE } from "../registry/services"
import type { AiService } from "../registry/services"
import { runImageEdit } from "../run-image"

/**
 * Aşama 4 (adr/0071 §9, §10): a result is fetched only from a listed host,
 * within a cap, as a raster image; its bytes pass the upload check and
 * get the IPTC mark; the original's bytes are never changed.
 */

jest.setTimeout(30_000)

// A service that names its results by address, on one listed host
const LISTING: AiService = {
  ...FAKE_SERVICE,
  id: "listing",
  hosts: ["api.example.com"],
  downloadHosts: ["files.example.com"],
}

const answer = (status: number, body: Buffer, type: string): SafeFetchResponse => ({
  status,
  headers: { "content-type": type },
  body,
  url: "https://files.example.com/r.png",
})

function fakeFetch(step: SafeFetchResponse | Error) {
  const calls: { url: string; options: SafeFetchOptions }[] = []
  const fetch = (input: string | URL, options?: SafeFetchOptions) => {
    calls.push({ url: String(input), options: options ?? {} })
    return step instanceof Error ? Promise.reject(step) : Promise.resolve(step)
  }
  return { fetch, calls }
}

async function refusal(run: Promise<unknown>) {
  const error: unknown = await run.then(
    () => {
      throw new Error("expected a refusal")
    },
    (thrown: unknown) => thrown
  )
  if (!isProviderError(error)) {
    throw error
  }
  return { key: error.safeMessage, code: error.providerCode }
}

const photo = (format: "png" | "avif" = "png") => {
  const image = sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 40, b: 40 } },
  })
  return image[format]().toBuffer()
}

const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>'
)

describe("downloading a result (adr/0071 §9)", () => {
  it("never fetches an address off the service's list", async () => {
    for (const address of [
      "https://evil.example.net/r.png",
      "http://files.example.com/r.png",
      "https://files.example.com.evil.net/r.png",
      "https://user:pw@files.example.com/r.png",
      "https://files.example.com:8443/r.png",
      "not an address",
    ]) {
      const { fetch, calls } = fakeFetch(answer(200, await photo(), "image/png"))
      expect(await refusal(downloadResult(LISTING, address, { fetch }))).toEqual({
        key: "ai.provider_response_invalid",
        code: "download_host_not_listed",
      })
      expect(calls).toHaveLength(0)
    }
  })

  it("fetches a listed address with no redirect and a size cap", async () => {
    const png = await photo()
    const { fetch, calls } = fakeFetch(answer(200, png, "image/png"))
    expect(
      (await downloadResult(LISTING, "https://files.example.com/r.png", { fetch })).equals(png)
    ).toBe(true)
    expect(calls[0]?.options.redirect).toBe("error")
    expect(calls[0]?.options.maxResponseBytes).toBe(40 * 1024 * 1024)
    expect(calls[0]?.options.method).toBe("GET")
  })

  it("refuses a redirect, an answer past the cap, an SVG or anything not an image", async () => {
    const url = "https://files.example.com/r.png"
    for (const [step, code] of [
      [new SafeFetchError("redirect_not_allowed"), "download_redirect_not_allowed"],
      [new SafeFetchError("response_too_large", { status: 200 }), "download_response_too_large"],
      [new SafeFetchError("address_not_allowed"), "download_address_not_allowed"],
      [answer(200, SVG, "image/svg+xml"), "download_not_an_image"],
      [answer(200, Buffer.from("<html/>"), "text/html"), "download_not_an_image"],
      [answer(302, Buffer.alloc(0), "image/png"), "download_http_302"],
    ] as const) {
      const { fetch } = fakeFetch(step)
      expect(await refusal(downloadResult(LISTING, url, { fetch }))).toEqual({
        key: "ai.provider_response_invalid",
        code,
      })
    }
  })
})

describe("one background edit (Aşama 4)", () => {
  const connectorOf = (
    result: (request: ImageEditRequest) => Promise<Buffer | string>
  ): { connector: ImageEditConnector; seen: ImageEditRequest[] } => {
    const seen: ImageEditRequest[] = []
    return {
      seen,
      connector: {
        async edit(request) {
          seen.push(request)
          const out = await result(request)
          return typeof out === "string"
            ? { kind: "url", url: out, usage: {} }
            : { kind: "bytes", bytes: out, usage: { inputTokens: 5 } }
        },
      },
    }
  }

  it("leaves the original's bytes as they were and marks the result as AI edited", async () => {
    const original = await photo()
    const copy = Buffer.from(original)
    const { connector } = connectorOf(async () =>
      sharp(original).flatten({ background: "#ffffff" }).png().toBuffer()
    )
    const done = await runImageEdit({
      connector,
      service: FAKE_SERVICE,
      original,
      name: "urun-ai",
      background: "white",
    })
    expect(original.equals(copy)).toBe(true)
    expect(done.image.buffer.equals(original)).toBe(false)
    expect(done.image.mimeType).toBe("image/png")
    expect(done.image.filename).toMatch(/^urun-ai.*\.png$/)
    const meta = await sharp(done.image.buffer).metadata()
    expect(digitalSourceTypeOf(meta.xmp)).toBe(DIGITAL_SOURCE_TYPES.edited)
    expect(done.usage).toEqual({ inputTokens: 5 })
  })

  it("sends a PNG copy of an AVIF original; the original stays AVIF", async () => {
    const original = await photo("avif")
    const copy = Buffer.from(original)
    const { connector, seen } = connectorOf((request) => Promise.resolve(request.image.bytes))
    await runImageEdit({
      connector,
      service: FAKE_SERVICE,
      original,
      name: "x",
      background: "white",
    })
    expect(seen[0]?.image.mimeType).toBe("image/png")
    expect(original.equals(copy)).toBe(true)
  })

  it("refuses an SVG coming back, whatever it says it is", async () => {
    const { connector } = connectorOf(() => Promise.resolve(SVG))
    expect(
      await refusal(
        runImageEdit({
          connector,
          service: FAKE_SERVICE,
          original: await photo(),
          name: "x",
          background: "white",
        })
      )
    ).toMatchObject({
      key: "ai.provider_response_invalid",
      code: expect.stringMatching(/^result_upload\./) as unknown,
    })
  })

  it("refuses a result address off the list, and fetches a listed one", async () => {
    const offList = connectorOf(() => Promise.resolve("https://evil.example.net/r.png"))
    const { fetch, calls } = fakeFetch(answer(200, await photo(), "image/png"))
    expect(
      await refusal(
        runImageEdit({
          connector: offList.connector,
          service: LISTING,
          original: await photo(),
          name: "x",
          background: "white",
          download: fetch,
        })
      )
    ).toEqual({ key: "ai.provider_response_invalid", code: "download_host_not_listed" })
    expect(calls).toHaveLength(0)

    const listed = connectorOf(() => Promise.resolve("https://files.example.com/r.png"))
    const done = await runImageEdit({
      connector: listed.connector,
      service: LISTING,
      original: await photo(),
      name: "x",
      background: "white",
      download: fetch,
    })
    expect(calls).toHaveLength(1)
    expect(digitalSourceTypeOf((await sharp(done.image.buffer).metadata()).xmp)).toBe(
      DIGITAL_SOURCE_TYPES.edited
    )
  })

  it("sends nothing for an original that is no raster image", async () => {
    const { connector, seen } = connectorOf(() => Promise.resolve(SVG))
    expect(
      await refusal(
        runImageEdit({
          connector,
          service: FAKE_SERVICE,
          original: SVG,
          name: "x",
          background: "white",
        })
      )
    ).toEqual({ key: "ai.input_unsupported", code: "not_a_raster_image" })
    expect(seen).toHaveLength(0)
  })
})
