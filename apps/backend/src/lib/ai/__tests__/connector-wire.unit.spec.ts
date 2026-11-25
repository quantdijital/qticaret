import { createHash } from "node:crypto"
import type { SafeFetchOptions, SafeFetchResponse } from "../../security/safe-fetch"
import { geminiImageEdit } from "../connectors/gemini-image"
import { openAiCompatibleText } from "../connectors/openai-compatible"
import { openAiCompatibleTools } from "../connectors/openai-tools"
import { photoroomImageEdit } from "../connectors/photoroom"
import { findAiService } from "../registry/services"
import type { AiService, ImageEditTarget, OpenAiCompatibleTarget } from "../registry/services"

/**
 * What each connector puts on the wire with a shop's own key, pinned
 * before the sending moved behind a transport (adr/0085 §3, P4a): the
 * address, the method, the headers in their order and case, the body to
 * the byte (a multipart boundary is random, so it is named `BOUNDARY`
 * first), the redirect rule, the time and size bounds. A change here is
 * a change of what a service receives.
 */

// Plainly fake: nothing here has the shape of a real key
const KEY = "test-key-wire-not-a-real-one"
const GEMINI_IMAGE =
  "https://generativelanguage.googleapis.com/v1/models/gemini-nano-banana-2.1:generateContent"
const PICTURE = { mimeType: "image/png", bytes: Buffer.from("not-really-a-png") }

interface Sent {
  url: string
  options: SafeFetchOptions
}

const garbage: SafeFetchResponse = {
  status: 200,
  headers: { "content-type": "text/plain" },
  body: Buffer.from("not an answer"),
  url: "https://example.invalid/",
}

function recorder() {
  const sent: Sent[] = []
  const fetch = (input: string | URL, options?: SafeFetchOptions) => {
    sent.push({ url: String(input), options: options ?? {} })
    return Promise.resolve(garbage)
  }
  return { fetch, sent, wait: () => Promise.resolve() }
}

/** The request as a service receives it, a boundary named the same every time. */
function wireOf({ url, options }: Sent) {
  const headers = Object.entries(options.headers ?? {})
  const type = headers.find(([name]) => name.toLowerCase() === "content-type")?.[1] ?? ""
  const boundary = /boundary=(.+)$/.exec(type)?.[1]
  const named = (text: string) => (boundary ? text.split(boundary).join("BOUNDARY") : text)
  const body = options.body
  const text = typeof body === "string" ? body : body === undefined ? "" : body.toString("latin1")
  return {
    url,
    method: options.method,
    headers: headers.map(([name, value]) => [name, named(value)]),
    bodyKind: typeof body === "string" ? "string" : "buffer",
    body: named(text),
    redirect: options.redirect,
    timeoutMs: options.timeoutMs,
    maxResponseBytes: options.maxResponseBytes,
    signal: options.signal instanceof AbortSignal,
  }
}

function firstOf(sent: readonly Sent[]): Sent {
  const [first] = sent
  if (first === undefined) {
    throw new Error("nothing was sent")
  }
  return first
}

const sha = (text: string) => createHash("sha256").update(text, "latin1").digest("hex")

function chatTarget(
  id: string,
  capability: "text" | "vision"
): { service: AiService; target: OpenAiCompatibleTarget } {
  const service = findAiService(id, "test")
  const target = service?.capabilities[capability]
  if (!service || target?.connector !== "openai-compatible") {
    throw new Error(`no ${capability} target for ${id}`)
  }
  return { service, target }
}

function imageTarget(id: string): { service: AiService; target: ImageEditTarget } {
  const service = findAiService(id, "test")
  const target = service?.capabilities.image_edit
  if (!service || (target?.connector !== "photoroom" && target?.connector !== "gemini-image")) {
    throw new Error(`no image target for ${id}`)
  }
  return { service, target }
}

const bearer = (key: string) => [
  ["Authorization", `Bearer ${key}`],
  ["Content-Type", "application/json"],
  ["Accept", "application/json"],
]

describe("what the connectors send with a shop's own key (pinned)", () => {
  it("text: DeepSeek's chat body with JSON mode and a temperature", async () => {
    const { fetch, sent, wait } = recorder()
    const connector = openAiCompatibleText({
      ...chatTarget("deepseek", "text"),
      apiKey: KEY,
      fetch,
      wait,
    })
    await connector
      .complete({ system: "Görev.", data: '{"a":1}', maxTokens: 50, json: true, temperature: 0.3 })
      .catch(() => undefined)
    expect(sent).toHaveLength(1)
    const wire = wireOf(firstOf(sent))
    expect(wire).toMatchObject({
      url: "https://api.deepseek.com/chat/completions",
      method: "POST",
      headers: bearer(KEY),
      bodyKind: "string",
      redirect: "error",
      timeoutMs: 60_000,
      maxResponseBytes: 2 * 1024 * 1024,
      signal: true,
    })
    expect(sha(wire.body)).toBe("3cc97a54eb0435bdb9d6d7f4a9ced1079bfbcb0d910b981077f1e0ef6a7745ae")
  })

  it("vision: Gemini's chat body with a picture inline", async () => {
    const { fetch, sent, wait } = recorder()
    const connector = openAiCompatibleText({
      ...chatTarget("gemini", "vision"),
      apiKey: KEY,
      fetch,
      wait,
    })
    await connector
      .complete({ system: "Görev.", data: '{"a":1}', maxTokens: 80, images: [PICTURE] })
      .catch(() => undefined)
    const wire = wireOf(firstOf(sent))
    expect(wire).toMatchObject({
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      method: "POST",
      headers: bearer(KEY),
      bodyKind: "string",
      redirect: "error",
      timeoutMs: 60_000,
      maxResponseBytes: 2 * 1024 * 1024,
      signal: true,
    })
    expect(sha(wire.body)).toBe("f46e4ab79335788adc234c45972d966fa2196c1eac7045c3d3b9274522ded796")
  })

  it("tools: DeepSeek's chat body with a tool", async () => {
    const { fetch, sent, wait } = recorder()
    const connector = openAiCompatibleTools({
      ...chatTarget("deepseek", "text"),
      apiKey: KEY,
      fetch,
      wait,
    })
    await connector
      .converse({
        messages: [
          { role: "system", content: "Rules." },
          { role: "user", content: "kargo" },
        ],
        tools: [
          { name: "find_page", description: "Finds a page.", parameters: { type: "object" } },
        ],
        maxTokens: 100,
      })
      .catch(() => undefined)
    const wire = wireOf(firstOf(sent))
    expect(wire).toMatchObject({
      url: "https://api.deepseek.com/chat/completions",
      headers: bearer(KEY),
      redirect: "error",
      timeoutMs: 30_000,
      maxResponseBytes: 2 * 1024 * 1024,
    })
    expect(sha(wire.body)).toBe("0f3a528142efc5d4ad93947a9e3e874cd6877865d349898026e0a65a35250610")
  })

  const photoroomHeaders = [
    ["x-api-key", KEY],
    ["Content-Type", "multipart/form-data; boundary=BOUNDARY"],
    ["Accept", "image/png, image/jpeg, application/json"],
  ]

  it("image edit: Photoroom's multipart body on a white background", async () => {
    const { fetch, sent, wait } = recorder()
    const connector = photoroomImageEdit({ ...imageTarget("photoroom"), apiKey: KEY, fetch, wait })
    await connector.edit({ image: PICTURE, background: "white" }).catch(() => undefined)
    const wire = wireOf(firstOf(sent))
    expect(wire).toMatchObject({
      url: "https://sdk.photoroom.com/v1/segment",
      method: "POST",
      headers: photoroomHeaders,
      bodyKind: "buffer",
      redirect: "error",
      timeoutMs: 120_000,
      signal: true,
    })
    expect(wire.maxResponseBytes).toBe(40 * 1024 * 1024)
    expect(sha(wire.body)).toBe("0ee44a2a9f5aba879a817105a80170316f619d4e2b1cc3881d6800018194cf9a")
  })

  it("image scene: Photoroom's multipart body to its scene endpoint", async () => {
    const { fetch, sent, wait } = recorder()
    const connector = photoroomImageEdit({ ...imageTarget("photoroom"), apiKey: KEY, fetch, wait })
    await connector.scene?.({ image: PICTURE, setting: "a wooden table" }).catch(() => undefined)
    const wire = wireOf(firstOf(sent))
    expect(wire).toMatchObject({
      url: "https://image-api.photoroom.com/v2/edit",
      headers: photoroomHeaders,
      bodyKind: "buffer",
      redirect: "error",
      timeoutMs: 120_000,
    })
    expect(sha(wire.body)).toBe("50b8d361b1de4cbc62e14037d659487077b0a67e31fb8e2d6180dc6891ca764c")
  })

  const geminiHeaders = [
    ["x-goog-api-key", KEY],
    ["Content-Type", "application/json"],
    ["Accept", "application/json"],
  ]

  it("image edit and scene: Gemini's JSON body with the picture inline", async () => {
    const { fetch, sent, wait } = recorder()
    const resolved = imageTarget("gemini")
    const connector = geminiImageEdit({ ...resolved, apiKey: KEY, fetch, wait })
    const background = resolved.target.backgrounds[0]
    if (background === undefined) {
      throw new Error("no background")
    }
    await connector.edit({ image: PICTURE, background }).catch(() => undefined)
    await connector.scene?.({ image: PICTURE, setting: "a wooden table" }).catch(() => undefined)
    expect(sent).toHaveLength(2)
    const [edit, scene] = sent.map(wireOf)
    expect(edit).toMatchObject({
      method: "POST",
      headers: geminiHeaders,
      bodyKind: "string",
      redirect: "error",
      timeoutMs: 120_000,
      signal: true,
    })
    expect(scene).toMatchObject({ headers: geminiHeaders, redirect: "error" })
    expect([edit?.url, scene?.url]).toEqual([GEMINI_IMAGE, GEMINI_IMAGE])
    expect([edit?.maxResponseBytes, sha(edit?.body ?? ""), sha(scene?.body ?? "")]).toEqual([
      30 * 1024 * 1024,
      "c371316dd06ebf5f018467d6f7c037426a5a7b7611cea9c4986cf5dd10f4064d",
      "f7ee608c57d1598a833ac4fe00f9fb2a09c06ae624d32a50589687de73416ca4",
    ])
  })
})
