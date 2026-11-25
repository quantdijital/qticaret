import type { AiCreditCapability, AiCreditTask } from "@qticaret/types/control-plane"
import { prepareBody } from "../body"
import { AI_GATEWAY_MAX_BODY_BYTES, AI_TEXT_MAX_BODY_BYTES } from "../limits"
import { gatewayTargetOf } from "../target"
import type { GatewayTarget } from "../target"

const target = (service: string, capability: AiCreditCapability, task: AiCreditTask) => {
  const found = gatewayTargetOf(service, capability, task)
  if (found === null) {
    throw new Error(`no target ${service} ${capability}`)
  }
  return found
}

const DEEPSEEK = target("deepseek", "text", "seo_title")
const MINIMAX = target("minimax", "text", "seo_title")
const GEMINI_IMAGE = target("gemini", "image_edit", "image_background")
const PHOTOROOM = target("photoroom", "image_edit", "image_background")

const json = (value: unknown) => Buffer.from(JSON.stringify(value))

const send = (
  body: unknown,
  options: {
    task?: AiCreditTask
    capability?: AiCreditCapability
    to?: GatewayTarget
    contentType?: string
  } = {}
) => {
  const result = prepareBody({
    raw: Buffer.isBuffer(body) ? body : json(body),
    contentType: options.contentType ?? "application/json",
    task: options.task ?? "seo_title",
    capability: options.capability ?? "text",
    target: options.to ?? DEEPSEEK,
  })
  return result
}

interface Sent {
  model?: unknown
  max_tokens?: unknown
  stream?: unknown
  tools?: unknown
  [field: string]: unknown
}

const sent = (result: ReturnType<typeof prepareBody>): Sent => {
  if (!result.ok) {
    throw new Error(`refused: ${result.reason}`)
  }
  return JSON.parse(result.body.toString("utf8")) as Sent
}

const chat = (extra: Record<string, unknown> = {}) => ({
  model: "gpt-dear-9",
  messages: [
    { role: "system", content: "s" },
    { role: "user", content: "u" },
  ],
  ...extra,
})

const picture = { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } }

describe("the provider body the gateway sends (adr/0085 K2)", () => {
  it("writes the routing's model whatever the shop named", () => {
    expect(sent(send(chat())).model).toBe("deepseek-flash")
    expect(sent(send(chat({ model: undefined }), { to: MINIMAX })).model).toBe("MiniMax-M3.1-Flash")
  })

  it("cuts the output budget to the task's, adds it when missing, keeps a smaller one", () => {
    expect(sent(send(chat({ max_tokens: 99_999 }))).max_tokens).toBe(360)
    expect(sent(send(chat())).max_tokens).toBe(360)
    expect(sent(send(chat({ max_tokens: 100 }))).max_tokens).toBe(100)
    // The target's own field only: the other one is taken out
    const minimax = sent(send(chat({ max_tokens: 50_000 }), { to: MINIMAX }))
    expect(minimax).toMatchObject({ max_completion_tokens: 360 })
    expect(minimax).not.toHaveProperty("max_tokens")
    expect(sent(send(chat({ max_tokens: 1e9 }), { task: "post_draft" })).max_tokens).toBe(8_000)
  })

  it("has no target for a chat no field caps (Gemini's text and vision)", () => {
    expect(gatewayTargetOf("gemini", "text", "seo_title")).toBeNull()
    expect(gatewayTargetOf("gemini", "vision", "image_alt_text")).toBeNull()
    // A chat body for a target without its field is refused once more
    const uncapped = { ...DEEPSEEK, maxTokensField: null }
    expect(send(chat(), { to: uncapped })).toMatchObject({ ok: false, reason: "uncapped" })
  })

  it("turns streaming off and asks for one answer", () => {
    const body = sent(send(chat({ stream: true, stream_options: { x: 1 }, n: 8 })))
    expect(body).toMatchObject({ stream: false })
    expect(body).not.toHaveProperty("n")
    expect(body).not.toHaveProperty("stream_options")
    expect(sent(send(chat())).stream).toBe(false)
  })

  it("takes tools on the assistant's turn only", () => {
    const tools = [{ type: "function", function: { name: "x" } }]
    for (const field of ["tools", "tool_choice", "functions", "function_call"]) {
      expect(send(chat({ [field]: tools }))).toMatchObject({
        ok: false,
        code: "body_refused",
        reason: "tools_not_allowed",
      })
    }
    expect(sent(send(chat({ tools }), { task: "assistant" })).tools).toEqual(tools)
  })

  it("holds pictures to the task's count, inline only", () => {
    const withPictures = (count: number, url = "data:image/jpeg;base64,AAAA") =>
      chat({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "t" },
              ...Array.from({ length: count }, () => ({ ...picture, image_url: { url } })),
            ],
          },
        ],
      })
    const vision = { task: "image_alt_text" as const, capability: "vision" as const }
    expect(send(withPictures(1), vision)).toMatchObject({ ok: true, images: 1 })
    expect(send(withPictures(2), vision)).toMatchObject({ ok: false, reason: "too_many_images" })
    // Plain text sends none, even a task that may see
    expect(send(withPictures(1), { task: "product_attributes" })).toMatchObject({ ok: false })
    expect(
      send(withPictures(1), { task: "product_attributes", capability: "vision" })
    ).toMatchObject({ ok: true })
    // An address the provider would fetch is not a picture we send
    expect(send(withPictures(1, "https://example.com/a.jpg"), vision)).toMatchObject({
      ok: false,
      reason: "image_not_inline",
    })
    expect(
      send(chat({ messages: [{ role: "user", content: [{ type: "input_audio" }] }] }), vision)
    ).toMatchObject({ ok: false })
  })

  it("holds a Gemini picture body: no model, one candidate, inline pictures, no file", () => {
    const gemini = (parts: unknown[], extra: Record<string, unknown> = {}) => ({
      model: "gemini-dear",
      contents: [{ parts }],
      generationConfig: { responseModalities: ["IMAGE"], candidateCount: 4 },
      ...extra,
    })
    const edit = { task: "image_background" as const, capability: "image_edit" as const }
    const one = [{ text: "t" }, { inline_data: { mime_type: "image/png", data: "AA" } }]
    const body = sent(send(gemini(one), { ...edit, to: GEMINI_IMAGE }))
    expect(body).not.toHaveProperty("model")
    expect(body).toMatchObject({ generationConfig: { candidateCount: 1 } })
    expect(send(gemini([...one, one[1]]), { ...edit, to: GEMINI_IMAGE })).toMatchObject({
      ok: false,
      reason: "too_many_images",
    })
    expect(
      send(gemini([{ file_data: { file_uri: "gs://x" } }]), { ...edit, to: GEMINI_IMAGE })
    ).toMatchObject({ ok: false, reason: "image_not_inline" })
    expect(send(gemini(one, { tools: [{}] }), { ...edit, to: GEMINI_IMAGE })).toMatchObject({
      ok: false,
      reason: "tools_not_allowed",
    })
  })

  it("passes a form's bytes as they came, its type with them", () => {
    const form = Buffer.from(
      "--b\r\ncontent-disposition: form-data; name=image_file\r\n\r\n\xff\x00--b--"
    )
    const type = "multipart/form-data; boundary=b"
    const result = send(form, {
      task: "image_background",
      capability: "image_edit",
      to: PHOTOROOM,
      contentType: type,
    })
    expect(result).toMatchObject({ ok: true, contentType: type })
    expect(result.ok && result.body.equals(form)).toBe(true)
    // A form without its boundary, JSON to a form endpoint, a form to a JSON one: refused
    const edit = { task: "image_background" as const, capability: "image_edit" as const }
    expect(
      send(form, { ...edit, to: PHOTOROOM, contentType: "multipart/form-data" })
    ).toMatchObject({ ok: false })
    expect(send(chat(), { ...edit, to: PHOTOROOM })).toMatchObject({ ok: false })
    expect(send(form, { contentType: type })).toMatchObject({ ok: false, reason: "type_not_json" })
  })

  it("refuses what is not a JSON object, and more than the task's input", () => {
    expect(send(Buffer.from("not json"))).toMatchObject({ ok: false, reason: "not_json" })
    expect(send([1, 2])).toMatchObject({ ok: false, reason: "not_an_object" })
    const long = chat({ messages: [{ role: "user", content: "x".repeat(AI_TEXT_MAX_BODY_BYTES) }] })
    expect(send(long)).toMatchObject({ ok: false, code: "body_too_large" })
    // The assistant's turn has twice the room
    expect(send(long, { task: "assistant" })).toMatchObject({ ok: true })
    const huge = Buffer.alloc(AI_GATEWAY_MAX_BODY_BYTES + 1, 0x20)
    expect(send(huge, { task: "image_alt_text", capability: "vision" })).toMatchObject({
      ok: false,
      code: "body_too_large",
    })
  })

  it("never changes the shop's signed bytes in place", () => {
    const raw = json(chat({ max_tokens: 99_999 }))
    const copy = Buffer.from(raw)
    send(raw)
    expect(raw.equals(copy)).toBe(true)
  })
})
