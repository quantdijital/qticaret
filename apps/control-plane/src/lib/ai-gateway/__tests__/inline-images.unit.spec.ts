import type { AiCreditCapability, AiCreditTask } from "@qticaret/types/control-plane"
import { prepareBody } from "../body"
import { checkInlineImage, isBase64 } from "../body-shared"
import { AI_INLINE_IMAGE_TYPES } from "../limits"
import { gatewayTargetOf } from "../target"
import type { GatewayTarget } from "../target"

/**
 * Second security review of P3b, N1: an inline picture is a PNG, JPEG or
 * WebP in base64, in either protocol; any other type (text, a PDF, an SVG)
 * or bytes that are not base64 are refused (`body_refused`, nothing
 * charged), so ~6 MB of text cannot pass as a picture and leave the text
 * limit behind.
 */

const target = (service: string, capability: AiCreditCapability, task: AiCreditTask) => {
  const found = gatewayTargetOf(service, capability, task)
  if (found === null) {
    throw new Error(`no target ${service} ${capability}`)
  }
  return found
}

const VISION = target("deepseek", "vision", "image_alt_text")
const GEMINI = target("gemini", "image_edit", "image_background")

const send = (
  body: unknown,
  to: GatewayTarget,
  task: AiCreditTask,
  capability: AiCreditCapability
) =>
  prepareBody({
    raw: Buffer.from(JSON.stringify(body)),
    contentType: "application/json",
    task,
    capability,
    target: to,
  })

const chatWith = (url: string) =>
  send(
    {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "t" },
            { type: "image_url", image_url: { url } },
          ],
        },
      ],
    },
    VISION,
    "image_alt_text",
    "vision"
  )

const geminiWith = (mimeType: string, data: string, snake = true) =>
  send(
    {
      contents: [
        {
          parts: [
            { text: "t" },
            snake
              ? { inline_data: { mime_type: mimeType, data } }
              : { inlineData: { mimeType, data } },
          ],
        },
      ],
    },
    GEMINI,
    "image_background",
    "image_edit"
  )

const B64 = Buffer.from("\x89PNG not really").toString("base64")
// Past the edit's 32 KB of text: passes only when it is counted as a picture
const LARGE = "A".repeat(200 * 1024)
const REFUSED_TYPES = ["text/plain", "application/pdf", "image/svg+xml", "image/heic", "image/gif"]

describe("an inline picture's type and bytes (P3b second review N1)", () => {
  it("takes the types the shop sends, in either protocol", () => {
    expect([...AI_INLINE_IMAGE_TYPES].sort()).toEqual(["image/jpeg", "image/png", "image/webp"])
    for (const type of AI_INLINE_IMAGE_TYPES) {
      expect(chatWith(`data:${type};base64,${B64}`)).toMatchObject({ ok: true, images: 1 })
      expect(geminiWith(type, B64)).toMatchObject({ ok: true, images: 1 })
      expect(geminiWith(type, B64, false)).toMatchObject({ ok: true, images: 1 })
      // A large picture's bytes stay off the text limit
      expect(geminiWith(type, LARGE)).toMatchObject({ ok: true })
    }
  })

  it.each(REFUSED_TYPES)("refuses %s as a picture, large or small", (type) => {
    const refused = { ok: false, code: "body_refused", reason: "image_type_refused" }
    expect(chatWith(`data:${type};base64,${B64}`)).toEqual(refused)
    expect(chatWith(`data:${type};base64,${LARGE}`)).toEqual(refused)
    expect(geminiWith(type, B64)).toEqual(refused)
    expect(geminiWith(type, LARGE, false)).toEqual(refused)
  })

  it("refuses bytes that are not base64", () => {
    const refused = { ok: false, code: "body_refused", reason: "image_data_refused" }
    for (const data of ["", "not base64!", "AAAA AAAA", "AA==AA", "<svg/>", "AAAA\n"]) {
      expect(chatWith(`data:image/png;base64,${data}`)).toEqual(refused)
      expect(geminiWith("image/png", data)).toEqual(refused)
    }
  })

  it("refuses a `data:` URL not written as a picture's base64, and any address", () => {
    for (const url of [
      `data:text/plain;base64,${B64}`,
      `data:image/png,${B64}`,
      `data:image/png;charset=utf-8;base64,${B64}`,
      `data:IMAGE/PNG;base64,${B64}`,
      "data:,hello",
    ]) {
      expect(chatWith(url)).toMatchObject({ ok: false, code: "body_refused" })
    }
    expect(chatWith("https://example.com/a.png")).toMatchObject({
      ok: false,
      reason: "image_not_inline",
    })
  })

  // A picture near 6 MB: once its check overflowed the regexp's stack now and then (`unreadable`)
  it("reads base64 as the anchored pattern did, a picture near 6 MB included", () => {
    const pattern = /^[A-Za-z0-9+/]+={0,2}$/
    const cases = [
      "QUFB",
      "QUE=",
      "QQ==",
      "Q",
      "",
      "=",
      "==",
      "QQ===",
      "Q=Q=",
      "QQ= ",
      "Q Q",
      "Q\n",
      "-_",
    ]
    for (const value of cases) {
      expect([value, isBase64(value)]).toEqual([value, pattern.test(value)])
    }
    const near6Mb = Buffer.alloc(4_400_000, 0x89).toString("base64")
    expect(isBase64(near6Mb)).toBe(true)
    expect(isBase64(`${near6Mb.slice(0, -1)}!`)).toBe(false)
    expect(() => {
      checkInlineImage("image/png", near6Mb)
    }).not.toThrow()
  })
})
