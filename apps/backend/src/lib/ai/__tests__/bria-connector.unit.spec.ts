import sharp from "sharp"
import { AI_SERVICE_TARGETS } from "@qticaret/types/control-plane"
import { isProviderError } from "../../errors/errors"
import { logger } from "../../logging"
import type { SafeFetchOptions, SafeFetchResponse } from "../../security/safe-fetch"
import { briaImageEdit } from "../connectors/bria"
import { imageConnectorWith } from "../image-connector-of"
import { findAiService } from "../registry/services"
import type { AiService, ImageEditTarget } from "../registry/services"
import { runImageEdit, runImageScene } from "../run-image"
import type { AiTransport, AiTransportRequest } from "../transport/types"

/**
 * Bria's connector (lib/ai/connectors/bria.ts): what it sends with a
 * shop's own key, how it reads the answer, and the result fetched from
 * its listed host alone, laid on white where white was asked for.
 */

jest.setTimeout(30_000)

// Plainly fake: nothing here has the shape of a real key
const KEY = "test-key-bria-not-a-real-one"
const PICTURE = { mimeType: "image/png", bytes: Buffer.from("not-really-a-png") }
const RESULT_URL = "https://engine.prod.bria-api.com/results/r.png"

function bria(): { service: AiService; target: ImageEditTarget } {
  const service = findAiService("bria", "production")
  const target = service?.capabilities.image_edit
  if (!service || target?.connector !== "bria") {
    throw new Error("no Bria target")
  }
  return { service, target }
}

const json = (status: number, body: unknown): SafeFetchResponse => ({
  status,
  headers: { "content-type": "application/json" },
  body: Buffer.from(JSON.stringify(body)),
  url: "https://engine.prod.bria-api.com/",
})

const done = json(200, { result: { image_url: RESULT_URL }, request_id: "r1" })

function recorder(answers: SafeFetchResponse[]) {
  const sent: { url: string; options: SafeFetchOptions }[] = []
  const fetch = (input: string | URL, options?: SafeFetchOptions) => {
    sent.push({ url: String(input), options: options ?? {} })
    const next = answers.shift()
    return next ? Promise.resolve(next) : Promise.reject(new Error("no answer left"))
  }
  return { fetch, sent, wait: () => Promise.resolve() }
}

const bodyOf = (options: SafeFetchOptions | undefined) =>
  JSON.parse(String(options?.body)) as Record<string, unknown>

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

describe("Bria's connector with a shop's own key", () => {
  it("sends a cut-out as JSON: the picture in base64, RMBG 2.0, synchronous; the key in api_token", async () => {
    const { fetch, sent, wait } = recorder([done])
    const connector = briaImageEdit({ ...bria(), apiKey: KEY, fetch, wait })
    const result = await connector.edit({ image: PICTURE, background: "transparent" })
    expect(result).toEqual({ kind: "url", url: RESULT_URL, usage: {} })
    const [first] = sent
    expect(first?.url).toBe("https://engine.prod.bria-api.com/v2/image/edit/remove_background")
    expect(Object.entries(first?.options.headers ?? {})).toEqual([
      ["api_token", KEY],
      ["Content-Type", "application/json"],
      ["Accept", "application/json"],
    ])
    expect(first?.options).toMatchObject({ method: "POST", redirect: "error" })
    expect(bodyOf(first?.options)).toEqual({
      image: PICTURE.bytes.toString("base64"),
      model: "RMBG2",
      sync: true,
    })
    expect(JSON.stringify(first?.options.body)).not.toContain(KEY)
  })

  it("asks for the same cut-out where white is wanted, marked to be laid on white", async () => {
    const { fetch, sent, wait } = recorder([done])
    const connector = briaImageEdit({ ...bria(), apiKey: KEY, fetch, wait })
    expect(await connector.edit({ image: PICTURE, background: "white" })).toEqual({
      kind: "url",
      url: RESULT_URL,
      usage: {},
      onWhite: true,
    })
    expect(bodyOf(sent[0]?.options)).not.toHaveProperty("prompt")
  })

  it("sends a scene to Replace Background in fibo2, at the input's size, with the setting as prompt", async () => {
    const { fetch, sent, wait } = recorder([done])
    const connector = briaImageEdit({ ...bria(), apiKey: KEY, fetch, wait })
    const result = await connector.scene?.({ image: PICTURE, setting: "a marble counter" })
    expect(result).toEqual({ kind: "url", url: RESULT_URL, usage: {} })
    expect(sent[0]?.url).toBe("https://engine.prod.bria-api.com/v2/image/edit/replace_background")
    expect(bodyOf(sent[0]?.options)).toEqual({
      image: PICTURE.bytes.toString("base64"),
      prompt: "a marble counter",
      ...AI_SERVICE_TARGETS.bria.capabilities.image_edit.scene.fixedBody,
    })
    expect(bria().target.scene?.source).toBe("edited")
  })

  it.each([
    [json(202, { request_id: "r", status_url: "https://x" }), "ai.provider_response_invalid"],
    [json(200, { request_id: "r" }), "ai.provider_response_invalid"],
    [json(422, { error: { code: 422, message: "moderation" } }), "ai.content_blocked"],
    [json(415, { error: { code: 415 } }), "ai.input_unsupported"],
    [json(401, { error: { code: 401 } }), "ai.key_rejected"],
  ])("reads an answer it cannot use as our key alone (%#)", async (answer, key) => {
    const { fetch, wait } = recorder([answer])
    const connector = briaImageEdit({ ...bria(), apiKey: KEY, fetch, wait })
    expect((await refusal(connector.edit({ image: PICTURE, background: "transparent" }))).key).toBe(
      key
    )
  })

  it("refuses a picture type it does not read before sending anything", async () => {
    const { fetch, sent, wait } = recorder([done])
    const connector = briaImageEdit({ ...bria(), apiKey: KEY, fetch, wait })
    const gif = { mimeType: "image/gif", bytes: Buffer.from("GIF89a") }
    expect(await refusal(connector.edit({ image: gif, background: "transparent" }))).toEqual({
      key: "ai.input_unsupported",
      code: "image_type_unsupported",
    })
    expect(sent).toHaveLength(0)
  })

  it("sends the same body through any transport (the platform's on credits)", async () => {
    const seen: AiTransportRequest[] = []
    const transport: AiTransport = {
      funding: "platform_credit",
      retries: false,
      send: (request) => {
        seen.push(request)
        return Promise.resolve({ status: done.status, headers: done.headers, body: done.body })
      },
    }
    await imageConnectorWith("bria", transport, "production").edit({
      image: PICTURE,
      background: "transparent",
    })
    expect(seen[0]?.to.service.id).toBe("bria")
    expect(JSON.parse(String(seen[0]?.body))).toEqual({
      image: PICTURE.bytes.toString("base64"),
      model: "RMBG2",
      sync: true,
    })
    expect(Object.keys(seen[0]?.headers ?? {})).toEqual(["Content-Type", "Accept"])
  })
})

describe("a Bria result fetched and kept", () => {
  const cutOut = () =>
    sharp({
      create: {
        width: 32,
        height: 24,
        channels: 4,
        background: { r: 10, g: 120, b: 10, alpha: 0 },
      },
    })
      .png()
      .toBuffer()
  const photo = () =>
    sharp({ create: { width: 32, height: 24, channels: 3, background: { r: 200, g: 40, b: 40 } } })
      .png()
      .toBuffer()

  const downloading = (bytes: Buffer) => {
    const calls: string[] = []
    const fetch = (input: string | URL) => {
      calls.push(String(input))
      return Promise.resolve({
        status: 200,
        headers: { "content-type": "image/png" },
        body: bytes,
        url: String(input),
      })
    }
    return { fetch, calls }
  }

  it("lays a cut-out on white where white was asked for: no transparent pixel left", async () => {
    const { service } = bria()
    const { fetch, calls } = downloading(await cutOut())
    const connector = {
      edit: () =>
        Promise.resolve({
          kind: "url" as const,
          url: RESULT_URL,
          usage: {},
          onWhite: true as const,
        }),
    }
    const result = await runImageEdit({
      connector,
      service,
      original: await photo(),
      name: "kept",
      background: "white",
      download: fetch,
    })
    expect(calls).toEqual([RESULT_URL])
    const stats = await sharp(result.image.buffer).stats()
    expect(stats.channels.slice(0, 3).every((channel) => channel.min >= 250)).toBe(true)
    expect((await sharp(result.image.buffer).metadata()).hasAlpha).toBe(false)
  })

  it("keeps a scene as edited, fetched from the listed host", async () => {
    const { service } = bria()
    const { fetch, calls } = downloading(await photo())
    const result = await runImageScene({
      connector: {
        edit: () => Promise.reject(new Error("not this one")),
        scene: () => Promise.resolve({ kind: "url", url: RESULT_URL, usage: {} }),
      },
      service,
      original: await photo(),
      name: "scene",
      setting: "a marble counter",
      source: "edited",
      download: fetch,
    })
    expect(calls).toEqual([RESULT_URL])
    expect(result.image.buffer.length).toBeGreaterThan(0)
  })

  it("never fetches a result off Bria's listed host, and logs the host alone", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)
    try {
      const { service } = bria()
      const { fetch, calls } = downloading(await photo())
      const elsewhere = "https://bucket.example.net/results/r.png?X-Signature=test-signed-token"
      const run = runImageEdit({
        connector: { edit: () => Promise.resolve({ kind: "url", url: elsewhere, usage: {} }) },
        service,
        original: await photo(),
        name: "kept",
        background: "transparent",
        download: fetch,
      })
      expect(await refusal(run)).toEqual({
        key: "ai.provider_response_invalid",
        code: "download_host_not_listed",
      })
      expect(calls).toEqual([])
      expect(warn).toHaveBeenCalledWith({
        event: "ai.download_host_not_listed",
        service: "bria",
        host: "bucket.example.net",
      })
      expect(JSON.stringify(warn.mock.calls)).not.toContain("test-signed-token")
    } finally {
      warn.mockRestore()
    }
  })
})
