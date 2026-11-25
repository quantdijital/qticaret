import type { AiCreditCapability, AiCreditTask } from "@qticaret/types/control-plane"
import { prepareBody } from "../body"
import {
  AI_ASSISTANT_MAX_BODY_BYTES,
  AI_IMAGE_EDIT_TEXT_MAX_BYTES,
  AI_LONG_TEXT_MAX_BYTES,
  AI_SHORT_TEXT_MAX_BYTES,
  maxTextBytesOf,
} from "../limits"
import { gatewayTargetOf } from "../target"

/**
 * The text one call may send, by task (security review of P3b O1): its
 * pictures' base64 aside, a short task 64 KB, a long one 128 KB, an edited
 * picture's instruction 32 KB, the assistant 512 KB. Past it: 413, free.
 */

const send = (body: unknown, task: AiCreditTask, capability: AiCreditCapability = "text") => {
  const service = capability === "image_edit" ? "gemini" : "deepseek"
  const target = gatewayTargetOf(service, capability, task)
  if (target === null) {
    throw new Error("no target")
  }
  return prepareBody({
    raw: Buffer.from(JSON.stringify(body)),
    contentType: "application/json",
    task,
    capability,
    target,
  })
}

const chat = (text: string, picture?: string) => ({
  messages: [
    { role: "system", content: "s" },
    {
      role: "user",
      content: picture
        ? [
            { type: "text", text },
            { type: "image_url", image_url: { url: picture } },
          ]
        : text,
    },
  ],
})

const KB = 1024
const PICTURE = `data:image/jpeg;base64,${"A".repeat(4 * KB * KB)}`
const tooLarge = { ok: false, code: "body_too_large", reason: "over_task_text" }

describe("the text a task may send (P3b review O1)", () => {
  it("holds each task to its own size", () => {
    expect(maxTextBytesOf("seo_title", "text")).toBe(AI_SHORT_TEXT_MAX_BYTES)
    expect(maxTextBytesOf("post_draft", "text")).toBe(AI_LONG_TEXT_MAX_BYTES)
    expect(maxTextBytesOf("image_alt_text", "vision")).toBe(AI_SHORT_TEXT_MAX_BYTES)
    expect(maxTextBytesOf("image_scene", "image_edit")).toBe(AI_IMAGE_EDIT_TEXT_MAX_BYTES)
    expect(maxTextBytesOf("assistant", "text")).toBe(AI_ASSISTANT_MAX_BODY_BYTES)

    expect(send(chat("x".repeat(60 * KB)), "seo_title")).toMatchObject({ ok: true })
    expect(send(chat("x".repeat(65 * KB)), "seo_title")).toMatchObject(tooLarge)
    expect(send(chat("x".repeat(120 * KB)), "post_draft")).toMatchObject({ ok: true })
    expect(send(chat("x".repeat(129 * KB)), "post_draft")).toMatchObject(tooLarge)
    expect(send(chat("x".repeat(400 * KB)), "assistant")).toMatchObject({ ok: true })
  })

  it("leaves a picture's base64 out of a picture call's text", () => {
    const vision = (text: string) => send(chat(text, PICTURE), "image_alt_text", "vision")
    expect(vision("x".repeat(10 * KB))).toMatchObject({ ok: true, images: 1 })
    // Six megabytes of text in place of a picture: one credit's worth of it only
    expect(vision("x".repeat(70 * KB))).toMatchObject(tooLarge)
    const edit = (text: string) =>
      send(
        {
          contents: [
            {
              parts: [
                { text },
                { inline_data: { mime_type: "image/png", data: "A".repeat(3 * KB * KB) } },
              ],
            },
          ],
        },
        "image_background",
        "image_edit"
      )
    expect(edit("Arka planı beyaz yap.")).toMatchObject({ ok: true })
    expect(edit("x".repeat(33 * KB))).toMatchObject(tooLarge)
  })

  it("takes a shop's full data block in Turkish for a short task", () => {
    // `MAX_DATA_CHARS` of Turkish text, as the shop clips its data block, and a long system message
    const words = 'Şam çeliği şef bıçağı; ağzı keskin, sapı ceviz "el yapımı". '
    const description = words.repeat(Math.ceil(30_000 / words.length)).slice(0, 29_950)
    const data = JSON.stringify({ data: { description } })
    const system = "Görev talimatı ve mağaza sahibinin notu. ".repeat(200)
    const body = {
      messages: [
        { role: "system", content: system },
        { role: "user", content: data },
      ],
    }
    expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(32 * KB)
    expect(send(body, "seo_title")).toMatchObject({ ok: true })
    expect(send(chat(data, PICTURE), "product_from_photo", "vision")).toMatchObject({ ok: true })
  })
})
