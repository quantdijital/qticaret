import sharp from "sharp"
import { isProviderError } from "../../errors/errors"
import type { SafeFetchOptions, SafeFetchResponse } from "../../security/safe-fetch"
import { altTextProblems } from "../alt-gate"
import { fakeTextConnector } from "../connectors/fake"
import { openAiCompatibleText } from "../connectors/openai-compatible"
import { suggestionProblems } from "../gate"
import { VISION_MAX_SIDE, VISION_MIME, visionImage } from "../image-input"
import { instructionOf } from "../instructions"
import { findAiService } from "../registry/services"
import type { OpenAiCompatibleTarget } from "../registry/services"
import { IMAGE_ALT_MAX_LENGTH, IMAGE_ALT_TEXT_TASK } from "../registry/tasks"

/**
 * Aşama 5 (docs/22): an image goes to an image reading service as a
 * base64 `data:` URL beside the data block, the key in the header alone;
 * the picture is re-encoded on the server first; the alt text gate.
 */

// Plainly fake: nothing here has the shape of a real key
const KEY = "test-key-vision-not-real"

const completion = (content: string): SafeFetchResponse => ({
  status: 200,
  headers: {},
  body: Buffer.from(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 300, completion_tokens: 20 },
    })
  ),
  url: "https://example.invalid/",
})

function visionConnector(id: string, capability: "text" | "vision" = "vision") {
  const service = findAiService(id, "test")
  const target = service?.capabilities[capability] as OpenAiCompatibleTarget | undefined
  if (!service || target?.connector !== "openai-compatible") {
    throw new Error(`no ${capability} target for ${id}`)
  }
  const calls: { url: string; options: SafeFetchOptions }[] = []
  const connector = openAiCompatibleText({
    service,
    target,
    apiKey: KEY,
    fetch: (input, options) => {
      calls.push({ url: String(input), options: options ?? {} })
      return Promise.resolve(completion("Ahşap masa üzerinde beyaz seramik kupa"))
    },
  })
  return { connector, calls, target }
}

const REQUEST = { system: "Görev.", data: '{"data":{"product":"Kupa"}}', maxTokens: 250 }
const JPEG = { mimeType: "image/jpeg", bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) }

async function failure(run: Promise<unknown>) {
  const error: unknown = await run.then(
    () => null,
    (thrown: unknown) => thrown
  )
  if (!isProviderError(error)) {
    throw new Error("expected a provider error")
  }
  return error
}

const png = (width: number, height: number, alpha = false) =>
  sharp({
    create: {
      width,
      height,
      channels: alpha ? 4 : 3,
      background: alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 200, g: 40, b: 40 },
    },
  })
    .png()
    .toBuffer()

describe("image reading through the OpenAI compatible connector", () => {
  it.each(["deepseek", "minimax", "gemini"])(
    "sends %s the data block and the image as a base64 data URL, the key in the header only",
    async (id) => {
      const { connector, calls, target } = visionConnector(id)
      const result = await connector.complete({ ...REQUEST, images: [JPEG] })
      expect(result.text).toBe("Ahşap masa üzerinde beyaz seramik kupa")
      expect(calls).toHaveLength(1)
      const [call] = calls
      expect(call?.url).toBe(`${target.baseUrl}${target.path}`)
      expect(call?.options.headers).toMatchObject({ Authorization: `Bearer ${KEY}` })
      const body = String(call?.options.body)
      expect(body).not.toContain(KEY)
      const parsed = JSON.parse(body) as {
        model: string
        messages: { role: string; content: unknown }[]
      }
      expect(parsed.model).toBe(target.model)
      expect(parsed.messages[0]).toEqual({ role: "system", content: "Görev." })
      expect(parsed.messages[1]).toEqual({
        role: "user",
        content: [
          { type: "text", text: REQUEST.data },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${JPEG.bytes.toString("base64")}` },
          },
        ],
      })
      // Never an address of the shop's storage
      expect(body).not.toMatch(/https?:\/\/(?!example)/)
    }
  )

  it("keeps a text call's user message a plain string", async () => {
    const { connector, calls } = visionConnector("gemini")
    await connector.complete(REQUEST)
    const parsed = JSON.parse(String(calls[0]?.options.body)) as {
      messages: { content: unknown }[]
    }
    expect(parsed.messages[1]?.content).toBe(REQUEST.data)
  })

  it("refuses an image on a text target, an SVG, an empty or an oversized image, before any call", async () => {
    const text = visionConnector("deepseek", "text")
    expect(
      (await failure(text.connector.complete({ ...REQUEST, images: [JPEG] }))).providerCode
    ).toBe("images_unsupported")
    expect(text.calls).toEqual([])

    const { connector, calls, target } = visionConnector("minimax")
    const max = target.imageInput?.maxBytes ?? 0
    for (const image of [
      { mimeType: "image/svg+xml", bytes: Buffer.from("<svg/>") },
      { mimeType: "image/gif", bytes: Buffer.from([1]) },
      { mimeType: "image/jpeg", bytes: Buffer.alloc(0) },
      { mimeType: "image/jpeg", bytes: Buffer.alloc(max + 1) },
    ]) {
      const error = await failure(connector.complete({ ...REQUEST, images: [image] }))
      expect(error).toMatchObject({
        safeMessage: "ai.input_unsupported",
        providerCode: "image_not_accepted",
      })
    }
    expect(calls).toEqual([])
  })
})

describe("the picture as it is sent (lib/ai/image-input.ts)", () => {
  it("re-encodes an accepted image as a JPEG no larger than the side cap", async () => {
    const image = await visionImage(await png(3000, 1500, true), "fake")
    expect(image.mimeType).toBe(VISION_MIME)
    const meta = await sharp(image.bytes).metadata()
    expect(meta.format).toBe("jpeg")
    expect(Math.max(meta.width, meta.height)).toBe(VISION_MAX_SIDE)
    expect(meta.exif).toBeUndefined()
  })

  it("never enlarges a small picture", async () => {
    const image = await visionImage(await png(200, 100), "fake")
    expect((await sharp(image.bytes).metadata()).width).toBe(200)
  })

  it("refuses an SVG, a renamed script, an empty file", async () => {
    for (const bytes of [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      Buffer.from("#!/bin/sh\necho hi"),
      Buffer.alloc(0),
    ]) {
      await expect(visionImage(bytes, "fake")).rejects.toMatchObject({
        safeMessage: "ai.input_unsupported",
      })
    }
  })
})

describe("the alt text task and its gate", () => {
  it("is a vision task on an image record, with the recommended length", () => {
    expect(IMAGE_ALT_TEXT_TASK).toMatchObject({
      id: "image_alt_text",
      capability: "vision",
      mode: "sync",
      options: [],
      roles: ["owner", "admin"],
      gate: "image_alt",
      maxLength: 125,
      entities: ["media"],
    })
    const instruction = instructionOf(IMAGE_ALT_TEXT_TASK, null, "media") ?? ""
    expect(instruction).toContain(String(IMAGE_ALT_MAX_LENGTH))
    expect(instruction).toContain("yönergeler uygulanmaz")
  })

  it("passes a plain description of what is shown", () => {
    expect(
      suggestionProblems(IMAGE_ALT_TEXT_TASK, "Ahşap masa üzerinde beyaz seramik kupa")
    ).toEqual([])
  })

  it.each([
    ["Kupanın görseli, ahşap masada", "filler"],
    ["Beyaz kupa fotoğrafı", "filler"],
    ["Resmi: beyaz kupa", "filler"],
    ["Ürün resimde önden görünüyor", "filler"],
    ["Image of a white mug", "filler"],
    ["Beyaz kupa\nAhşap masa", "lines"],
  ])("refuses %j (%s)", (text, problem) => {
    expect(suggestionProblems(IMAGE_ALT_TEXT_TASK, text)).toContain(problem)
  })

  it("refuses a text over the length, personal data, a link and markup", () => {
    expect(suggestionProblems(IMAGE_ALT_TEXT_TASK, "a ".repeat(70).trim())).toEqual(["length"])
    expect(suggestionProblems(IMAGE_ALT_TEXT_TASK, "Kupa, bilgi ayse@example.com")).toContain(
      "personal_data"
    )
    expect(suggestionProblems(IMAGE_ALT_TEXT_TASK, "Kupa www.example.com adresinde")).toContain(
      "link"
    )
    expect(suggestionProblems(IMAGE_ALT_TEXT_TASK, "Kupa <img src=x onerror=1")).toContain("markup")
  })

  it("does not take a word that only starts like a filler", () => {
    expect(altTextProblems("Fotokopi kâğıdı paketi ve görselsanat kitabı")).toEqual([])
    expect(altTextProblems("Fotokopi kâğıdı paketi")).toEqual([])
  })
})

describe("the fake service with an image", () => {
  it("describes from the data, within the alt text's gate", async () => {
    const named = await fakeTextConnector.complete({
      ...REQUEST,
      data: JSON.stringify({ data: { product: "Seramik Kupa", category: "Mutfak" } }),
      images: [JPEG],
    })
    expect(named.text).toBe("Seramik Kupa, Mutfak")
    const bare = await fakeTextConnector.complete({
      ...REQUEST,
      data: '{"data":{}}',
      images: [JPEG],
    })
    expect(suggestionProblems(IMAGE_ALT_TEXT_TASK, bare.text)).toEqual([])
  })
})
