import sharp from "sharp"
import { isProviderError } from "../../errors/errors"
import { SafeFetchError } from "../../security/safe-fetch"
import type { SafeFetchOptions, SafeFetchResponse } from "../../security/safe-fetch"
import { geminiImageEdit } from "../connectors/gemini-image"
import { photoroomImageEdit } from "../connectors/photoroom"
import { findAiService } from "../registry/services"
import type { AiService, ImageEditTarget } from "../registry/services"

/**
 * Aşama 4 connectors against recorded answers (adr/0071 §2: no test
 * leaves the machine): the registry's address, the key in its header
 * alone, the documented body, and errors that carry none of the key or
 * of the service's words.
 */

// Plainly fake: nothing here has the shape of a real key
const KEY = "test-key-not-a-real-one"
const SERVICE_SAID = "Invalid key test-key-not-a-real-one for account 42"

type Step = SafeFetchResponse | Error

const answer = (status: number, body: Buffer | string, type = "application/json"): Step => ({
  status,
  headers: { "content-type": type },
  body: typeof body === "string" ? Buffer.from(body) : body,
  url: "https://example.invalid/",
})

let PNG: Buffer
beforeAll(async () => {
  PNG = await sharp({
    create: { width: 40, height: 30, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer()
})

function targetOf(id: string): { service: AiService; target: ImageEditTarget } {
  const service = findAiService(id, "test")
  const target = service?.capabilities.image_edit
  if (!service || (target?.connector !== "photoroom" && target?.connector !== "gemini-image")) {
    throw new Error(`no image target for ${id}`)
  }
  return { service, target }
}

function fakeFetch(steps: Step[]) {
  const calls: { url: string; options: SafeFetchOptions }[] = []
  const fetch = (input: string | URL, options?: SafeFetchOptions) => {
    calls.push({ url: String(input), options: options ?? {} })
    const step = steps.shift()
    if (step === undefined) {
      throw new Error("no more answers")
    }
    return step instanceof Error ? Promise.reject(step) : Promise.resolve(step)
  }
  return { fetch, calls }
}

const noWait = () => Promise.resolve()

async function failure(run: Promise<unknown>) {
  const error: unknown = await run.then(
    () => {
      throw new Error("expected a failure")
    },
    (thrown: unknown) => thrown
  )
  if (!isProviderError(error)) {
    throw new Error("expected a provider error")
  }
  // Nothing of the key or the service's words, wherever it is written
  expect(JSON.stringify(error)).not.toContain(KEY)
  expect(JSON.stringify(error)).not.toContain(SERVICE_SAID)
  expect(String(error.stack)).not.toContain(KEY)
  return { key: error.safeMessage, code: error.providerCode }
}

describe("Photoroom (Remove Background API)", () => {
  const edit = (steps: Step[]) => {
    const { fetch, calls } = fakeFetch(steps)
    const connector = photoroomImageEdit({
      ...targetOf("photoroom"),
      apiKey: KEY,
      fetch,
      wait: noWait,
    })
    return { connector, calls }
  }

  it("posts the picture as multipart image_file to the registry's address, the key in x-api-key", async () => {
    const { connector, calls } = edit([answer(200, PNG, "image/png")])
    const result = await connector.edit({
      image: { mimeType: "image/png", bytes: PNG },
      background: "transparent",
    })
    expect(result).toEqual({ kind: "bytes", bytes: PNG, usage: {} })
    expect(calls).toHaveLength(1)
    const [call] = calls
    expect(call?.url).toBe("https://sdk.photoroom.com/v1/segment")
    expect(call?.url).not.toContain(KEY)
    expect(call?.options.method).toBe("POST")
    expect(call?.options.redirect).toBe("error")
    expect(call?.options.headers?.["x-api-key"]).toBe(KEY)
    expect(call?.options.headers?.["Content-Type"]).toMatch(/^multipart\/form-data; boundary=/)
    const body = (call?.options.body as Buffer).toString("latin1")
    expect(body).toContain('name="image_file"; filename="image.png"')
    expect(body).toContain('name="format"\r\n\r\npng')
    expect(body).not.toContain("bg_color")
    // The key is in the header and nowhere in the body
    expect(body).not.toContain(KEY)
  })

  it("asks for a white background as bg_color on a JPEG", async () => {
    const { connector, calls } = edit([answer(200, PNG, "image/jpeg")])
    await connector.edit({ image: { mimeType: "image/jpeg", bytes: PNG }, background: "white" })
    const body = (calls[0]?.options.body as Buffer).toString("latin1")
    expect(body).toContain('name="bg_color"\r\n\r\nwhite')
    expect(body).toContain('name="format"\r\n\r\njpg')
  })

  it("reads the JSON answer's base64img too", async () => {
    const { connector } = edit([answer(200, JSON.stringify({ base64img: PNG.toString("base64") }))])
    const result = await connector.edit({
      image: { mimeType: "image/png", bytes: PNG },
      background: "transparent",
    })
    expect(result.kind === "bytes" && result.bytes.equals(PNG)).toBe(true)
  })

  it("refuses an answer that is no image", async () => {
    const { connector } = edit([answer(200, "<svg/>", "image/svg+xml; charset=utf-8")])
    // The kind of answer passes here; the upload check reads its bytes next (run-image)
    const passed = await connector.edit({
      image: { mimeType: "image/png", bytes: PNG },
      background: "white",
    })
    expect(passed.kind).toBe("bytes")
    const html = edit([answer(200, "<html></html>", "text/html")])
    expect(
      await failure(
        html.connector.edit({ image: { mimeType: "image/png", bytes: PNG }, background: "white" })
      )
    ).toEqual({ key: "ai.provider_response_invalid", code: "not_an_image" })
  })

  it("maps 402 to no balance and a refused key to key_rejected, without the service's words", async () => {
    const poor = edit([answer(402, JSON.stringify({ detail: SERVICE_SAID }))])
    expect(
      await failure(
        poor.connector.edit({ image: { mimeType: "image/png", bytes: PNG }, background: "white" })
      )
    ).toEqual({ key: "ai.provider_balance", code: "http_402" })
    const refused = edit([answer(403, SERVICE_SAID, "text/plain")])
    expect(
      await failure(
        refused.connector.edit({
          image: { mimeType: "image/png", bytes: PNG },
          background: "white",
        })
      )
    ).toEqual({ key: "ai.key_rejected", code: "http_403" })
  })

  it("tries a busy service again once, a timeout never", async () => {
    const busy = edit([answer(429, "{}"), answer(200, PNG, "image/png")])
    await busy.connector.edit({ image: { mimeType: "image/png", bytes: PNG }, background: "white" })
    expect(busy.calls).toHaveLength(2)
    const slow = edit([new SafeFetchError("timeout"), answer(200, PNG, "image/png")])
    expect(
      await failure(
        slow.connector.edit({ image: { mimeType: "image/png", bytes: PNG }, background: "white" })
      )
    ).toMatchObject({ key: "ai.timeout" })
    expect(slow.calls).toHaveLength(1)
  })

  it("refuses an AVIF before any call (the endpoint reads none)", async () => {
    const { connector, calls } = edit([])
    expect(
      await failure(
        connector.edit({ image: { mimeType: "image/avif", bytes: PNG }, background: "white" })
      )
    ).toEqual({ key: "ai.input_unsupported", code: "image_type_unsupported" })
    expect(calls).toHaveLength(0)
  })
})

describe("Gemini image editing", () => {
  const edit = (steps: Step[]) => {
    const { fetch, calls } = fakeFetch(steps)
    const connector = geminiImageEdit({ ...targetOf("gemini"), apiKey: KEY, fetch, wait: noWait })
    return { connector, calls }
  }
  const generated = (parts: unknown[], extra: Record<string, unknown> = {}) =>
    answer(
      200,
      JSON.stringify({
        candidates: [{ content: { parts }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 1290 },
        ...extra,
      })
    )

  it("sends the picture inline with the fixed instruction, the key in x-goog-api-key, never in the address", async () => {
    const { connector, calls } = edit([
      generated([
        { text: "Here" },
        { inlineData: { mimeType: "image/png", data: PNG.toString("base64") } },
      ]),
    ])
    const result = await connector.edit({
      image: { mimeType: "image/png", bytes: PNG },
      background: "white",
    })
    expect(result).toEqual({
      kind: "bytes",
      bytes: PNG,
      usage: { inputTokens: 300, outputTokens: 1290 },
    })
    const [call] = calls
    expect(call?.url).toBe(
      "https://generativelanguage.googleapis.com/v1/models/gemini-nano-banana-2.1:generateContent"
    )
    expect(new URL(call?.url ?? "").search).toBe("")
    expect(call?.options.headers?.["x-goog-api-key"]).toBe(KEY)
    expect(call?.options.redirect).toBe("error")
    const body = JSON.parse(String(call?.options.body)) as {
      contents: { parts: Record<string, { mime_type?: string; data?: string } | string>[] }[]
      generationConfig: unknown
    }
    expect(body.generationConfig).toEqual({ responseModalities: ["IMAGE"] })
    const parts = body.contents[0]?.parts ?? []
    expect(parts[0]?.["text"]).toMatch(/pure white/)
    expect(parts[1]?.["inline_data"]).toEqual({
      mime_type: "image/png",
      data: PNG.toString("base64"),
    })
    expect(String(call?.options.body)).not.toContain(KEY)
  })

  it("makes no transparent background: refused before any call", async () => {
    const { connector, calls } = edit([])
    expect(
      await failure(
        connector.edit({ image: { mimeType: "image/png", bytes: PNG }, background: "transparent" })
      )
    ).toEqual({ key: "ai.input_unsupported", code: "background_unsupported" })
    expect(calls).toHaveLength(0)
  })

  it("tells a blocked request and an answer with no image apart", async () => {
    const blocked = edit([
      answer(200, JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } })),
    ])
    expect(
      await failure(
        blocked.connector.edit({
          image: { mimeType: "image/png", bytes: PNG },
          background: "white",
        })
      )
    ).toEqual({ key: "ai.content_blocked", code: "prompt_blocked" })
    const unsafe = edit([
      answer(200, JSON.stringify({ candidates: [{ finishReason: "IMAGE_SAFETY" }] })),
    ])
    expect(
      await failure(
        unsafe.connector.edit({ image: { mimeType: "image/png", bytes: PNG }, background: "white" })
      )
    ).toEqual({ key: "ai.content_blocked", code: "finish_blocked" })
    const textOnly = edit([generated([{ text: SERVICE_SAID }])])
    expect(
      await failure(
        textOnly.connector.edit({
          image: { mimeType: "image/png", bytes: PNG },
          background: "white",
        })
      )
    ).toEqual({ key: "ai.provider_response_invalid", code: "no_image" })
  })

  it("maps a refused key without the service's words", async () => {
    const { connector } = edit([answer(401, JSON.stringify({ error: { message: SERVICE_SAID } }))])
    expect(
      await failure(
        connector.edit({ image: { mimeType: "image/png", bytes: PNG }, background: "white" })
      )
    ).toEqual({ key: "ai.key_rejected", code: "http_401" })
  })
})
