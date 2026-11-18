import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"
import { isProviderError } from "../../errors/errors"
import { DIGITAL_SOURCE_TYPES, digitalSourceTypeOf } from "../../media"
import type { SafeFetchOptions, SafeFetchResponse } from "../../security/safe-fetch"
import { fakeImageConnector } from "../connectors/fake-image"
import { geminiImageEdit, sceneInstruction } from "../connectors/gemini-image"
import type { ImageEditConnector } from "../connectors/image-types"
import { photoroomImageEdit } from "../connectors/photoroom"
import { FAKE_SERVICE, findAiService } from "../registry/services"
import type { AiService, ImageEditTarget } from "../registry/services"
import { runImageScene } from "../run-image"
import { SCENE_FALLBACK_PACK, scenesOfPacks, shopSceneOf, shopScenes } from "../scenes"

/**
 * Aşama 7 (docs/22): a product photo set in one of the shop's scenes. The
 * connectors against recorded answers (nothing leaves the machine), the
 * scenes read from sector pack data with the general pack as fallback, a
 * code off the shop's list refused, the IPTC mark as the endpoint is
 * recorded, the original's bytes untouched.
 */

jest.setTimeout(30_000)

const KEY = "test-key-not-a-real-one"
const SETTING = "a plain wooden table in soft window light"

let PNG: Buffer
beforeAll(async () => {
  PNG = await sharp({
    create: { width: 40, height: 30, channels: 3, background: { r: 10, g: 120, b: 30 } },
  })
    .png()
    .toBuffer()
})

const answer = (body: Buffer | string, type = "application/json"): SafeFetchResponse => ({
  status: 200,
  headers: { "content-type": type },
  body: typeof body === "string" ? Buffer.from(body) : body,
  url: "https://example.invalid/",
})

function fakeFetch(step: SafeFetchResponse) {
  const calls: { url: string; options: SafeFetchOptions }[] = []
  const fetch = (input: string | URL, options?: SafeFetchOptions) => {
    calls.push({ url: String(input), options: options ?? {} })
    return Promise.resolve(step)
  }
  return { fetch, calls }
}

function targetOf(id: string): { service: AiService; target: ImageEditTarget } {
  const service = findAiService(id, "production")
  const target = service?.capabilities.image_edit
  if (!service || (target?.connector !== "photoroom" && target?.connector !== "gemini-image")) {
    throw new Error(`no image target for ${id}`)
  }
  return { service, target }
}

describe("Gemini scene (generateContent)", () => {
  it("sends the photo and the pack's setting in fixed words that keep the product", async () => {
    const { service, target } = targetOf("gemini")
    const { fetch, calls } = fakeFetch(
      answer(
        JSON.stringify({
          candidates: [{ content: { parts: [{ inlineData: { data: PNG.toString("base64") } }] } }],
          usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 1300 },
        })
      )
    )
    const connector = geminiImageEdit({ service, target, apiKey: KEY, fetch })
    const result = await connector.scene?.({
      image: { mimeType: "image/png", bytes: PNG },
      setting: SETTING,
    })
    expect(result).toMatchObject({ kind: "bytes", usage: { inputTokens: 300, outputTokens: 1300 } })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(target.scene?.url)
    expect(calls[0]?.options.headers).toMatchObject({ "x-goog-api-key": KEY })
    expect(calls[0]?.url).not.toContain(KEY)
    const body = JSON.parse(String(calls[0]?.options.body)) as {
      contents: { parts: { text?: string; inline_data?: { data: string } }[] }[]
      generationConfig: unknown
    }
    const [text, image] = body.contents[0]?.parts ?? []
    expect(text?.text).toBe(sceneInstruction(SETTING))
    expect(text?.text).toContain(SETTING)
    expect(text?.text).toContain("same shape, proportions, colours")
    expect(text?.text).toContain("text, labels and logos")
    expect(image?.inline_data?.data).toBe(PNG.toString("base64"))
    expect(body.generationConfig).toEqual({ responseModalities: ["IMAGE"] })
  })

  it("reads a blocked scene as blocked", async () => {
    const { service, target } = targetOf("gemini")
    const { fetch } = fakeFetch(
      answer(JSON.stringify({ promptFeedback: { blockReason: "OTHER" } }))
    )
    const run = geminiImageEdit({ service, target, apiKey: KEY, fetch }).scene?.({
      image: { mimeType: "image/png", bytes: PNG },
      setting: SETTING,
    })
    const error: unknown = await run?.catch((thrown: unknown) => thrown)
    expect(isProviderError(error) && error.safeMessage).toBe("ai.content_blocked")
  })
})

describe("Photoroom scene (Image Editing API, AI Backgrounds)", () => {
  it("posts imageFile and background.prompt to /v2/edit with the key in x-api-key", async () => {
    const { service, target } = targetOf("photoroom")
    const { fetch, calls } = fakeFetch(answer(PNG, "image/png"))
    const result = await photoroomImageEdit({ service, target, apiKey: KEY, fetch }).scene?.({
      image: { mimeType: "image/png", bytes: PNG },
      setting: SETTING,
    })
    expect(result).toEqual({ kind: "bytes", bytes: PNG, usage: {} })
    expect(calls[0]?.url).toBe("https://image-api.photoroom.com/v2/edit")
    const headers = calls[0]?.options.headers as Record<string, string>
    expect(headers["x-api-key"]).toBe(KEY)
    expect(headers["Content-Type"]).toMatch(/^multipart\/form-data; boundary=/)
    const body = String(calls[0]?.options.body)
    expect(body).toContain(`name="background.prompt"\r\n\r\n${SETTING}\r\n`)
    expect(body).toContain(`name="referenceBox"\r\n\r\noriginalImage\r\n`)
    expect(body).toContain('name="imageFile"; filename="image.png"')
    expect(body).not.toContain(KEY)
  })

  it("has no scene where the registry records none", () => {
    const withoutScene = (target: ImageEditTarget): ImageEditTarget => ({
      connector: target.connector,
      model: target.model,
      url: target.url,
      backgrounds: target.backgrounds,
    })
    const { service, target } = targetOf("photoroom")
    const plain = withoutScene(target)
    expect(photoroomImageEdit({ service, target: plain, apiKey: KEY }).scene).toBeUndefined()
    const gemini = targetOf("gemini")
    const bare = withoutScene(gemini.target)
    expect(geminiImageEdit({ ...gemini, target: bare, apiKey: KEY }).scene).toBeUndefined()
  })
})

describe("running a scene (adr/0071 §9, §10)", () => {
  it.each([
    ["edited", DIGITAL_SOURCE_TYPES.edited],
    ["generated", DIGITAL_SOURCE_TYPES.generated],
  ] as const)("marks a %s scene's result with its IPTC term", async (source, term) => {
    const original = Buffer.from(PNG)
    const done = await runImageScene({
      connector: fakeImageConnector,
      service: FAKE_SERVICE,
      original,
      name: "vazo-ai",
      setting: SETTING,
      source,
    })
    expect(original.equals(PNG)).toBe(true)
    const meta = await sharp(done.image.buffer).metadata()
    expect(digitalSourceTypeOf(meta.xmp)).toBe(term)
    // The fake scene sets the picture on a canvas twice its size: a new picture
    expect([meta.width, meta.height]).toEqual([80, 60])
  })

  it("refuses a scene on a connector that has none, calling nothing", async () => {
    let called = false
    const connector: ImageEditConnector = {
      edit: () => {
        called = true
        return Promise.resolve({ kind: "bytes", bytes: PNG, usage: {} })
      },
    }
    const error: unknown = await runImageScene({
      connector,
      service: FAKE_SERVICE,
      original: PNG,
      name: "x",
      setting: SETTING,
      source: "edited",
    }).catch((thrown: unknown) => thrown)
    expect(isProviderError(error) && error.providerCode).toBe("scene_unsupported")
    expect(called).toBe(false)
  })
})

describe("the shop's scenes (sector pack data)", () => {
  let root: string
  const pack = (code: string, scenes?: unknown) => {
    const dir = join(root, code)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({
        format: "quant-sector-pack",
        code,
        version: 1,
        name: "Deneme",
        description: "Bir deneme paketi.",
      })
    )
    if (scenes !== undefined) {
      writeFileSync(join(dir, "scenes.json"), JSON.stringify(scenes))
    }
  }
  const scene = (code: string) => ({
    code,
    name: { tr: `Sahne ${code}`, en: `Scene ${code}` },
    prompt: `a calm neutral setting number ${code} in soft light`,
  })

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ai-scenes-"))
    pack(SCENE_FALLBACK_PACK, [scene("neutral_a"), scene("neutral_b")])
    pack("first", [scene("first_a")])
    pack("bare")
    pack("second", [scene("second_a"), scene("second_b")])
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const codes = (applied: string[]) => scenesOfPacks(applied, root).map((each) => each.code)

  it("takes the first applied pack that has scenes", () => {
    expect(codes(["bare", "first", "second"])).toEqual(["first_a"])
    expect(codes(["second", "first"])).toEqual(["second_a", "second_b"])
  })

  it("falls back to the general pack's neutral scenes", () => {
    expect(codes([])).toEqual(["neutral_a", "neutral_b"])
    expect(codes(["bare", SCENE_FALLBACK_PACK])).toEqual(["neutral_a", "neutral_b"])
    expect(codes(["no-such-pack"])).toEqual(["neutral_a", "neutral_b"])
  })

  it("skips a pack its loader refuses", () => {
    pack("broken", [scene("a"), scene("b"), scene("c")])
    expect(codes(["broken"])).toEqual(["neutral_a", "neutral_b"])
  })
})

describe("the shop's scenes in this build", () => {
  const containerWith = (packs: string[]) => ({
    resolve: () => ({
      listSectorPackApplications: () => Promise.resolve(packs.map((pack) => ({ pack }))),
    }),
  })

  it("gives a shop with no pack the general pack's two scenes", async () => {
    const scenes = await shopScenes(containerWith([]) as never)
    expect(scenes.map((each) => each.code)).toEqual(["studio_table", "daylight_surface"])
  })

  it("gives a shop its sector pack's scenes, and refuses a code off its list", async () => {
    const container = containerWith(["cutlery"]) as never
    const scenes = await shopScenes(container)
    expect(scenes).toHaveLength(2)
    expect(scenes.map((each) => each.code)).not.toContain("studio_table")
    expect(await shopSceneOf(container, scenes[0]?.code ?? "")).toEqual(scenes[0])
    // The general pack's scene is not this shop's; nor is a made-up one
    expect(await shopSceneOf(container, "studio_table")).toBeNull()
    expect(await shopSceneOf(container, "anything_else")).toBeNull()
  })
})
