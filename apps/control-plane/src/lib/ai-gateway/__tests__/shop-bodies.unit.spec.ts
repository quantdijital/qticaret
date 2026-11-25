import { join } from "node:path"
import type { AiCreditCapability, AiCreditTask } from "@qticaret/types/control-plane"
import { prepareBody } from "../body"
import { gatewayTargetOf } from "../target"

/**
 * The bodies the shop's own connectors build today (apps/backend
 * lib/ai/connectors), captured before they leave, rebuilt by the gateway's
 * allow-list: the same in meaning, so no call the shop makes is changed
 * (security review of P3b C1). Loaded at run time: the app's TypeScript
 * root ends here.
 */

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names what it loads
const shop = <T>(path: string): T =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a path outside this app's root, test only
  require(join(__dirname, "../../../../../backend/src/lib/ai", path)) as T

type Captured = (url: unknown, init: { body: unknown }) => Promise<never>
interface ShopService {
  id: string
  capabilities: Record<string, Record<string, unknown>>
}
interface Options {
  service: ShopService
  target: unknown
  apiKey: string
  fetch: Captured
  wait: () => Promise<void>
}

const { aiServices } = shop<{ aiServices: (env: string) => readonly ShopService[] }>(
  "registry/services"
)
const { openAiCompatibleText } = shop<{
  openAiCompatibleText: (options: Options) => { complete: (request: unknown) => Promise<unknown> }
}>("connectors/openai-compatible")
const { converseBodyOf } = shop<{
  converseBodyOf: (target: unknown, request: unknown) => string
}>("connectors/openai-tools")
const { geminiImageEdit } = shop<{
  geminiImageEdit: (options: Options) => {
    edit: (request: unknown) => Promise<unknown>
    scene?: (request: unknown) => Promise<unknown>
  }
}>("connectors/gemini-image")

const serviceOf = (id: string): ShopService => {
  const found = aiServices("production").find((service) => service.id === id)
  if (!found) {
    throw new Error(`no shop service ${id}`)
  }
  return found
}

const NOT_A_KEY = ["not", "a", "key"].join("-")
const picture = { mimeType: "image/png", bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }

/** What a connector posts, caught at its fetch (which never answers). */
async function captured(
  call: (options: Options) => Promise<unknown>,
  service: ShopService,
  target: unknown
): Promise<string[]> {
  const bodies: string[] = []
  const fetch: Captured = (_url, init) => {
    bodies.push(String(init.body))
    return Promise.reject(new Error("captured"))
  }
  await call({ service, target, apiKey: NOT_A_KEY, fetch, wait: () => Promise.resolve() }).catch(
    () => undefined
  )
  return bodies
}

const rebuilt = (
  body: string,
  service: string,
  task: AiCreditTask,
  capability: AiCreditCapability
): unknown => {
  const target = gatewayTargetOf(service, capability, task)
  if (target === null) {
    throw new Error(`no gateway target ${service}`)
  }
  const result = prepareBody({
    raw: Buffer.from(body),
    contentType: "application/json",
    task,
    capability,
    target,
  })
  if (!result.ok) {
    throw new Error(`refused: ${result.reason}`)
  }
  return JSON.parse(result.body.toString("utf8"))
}

describe("the shop's bodies through the gateway's allow-list (P3b review C1)", () => {
  it.each(["deepseek", "minimax"])("%s: a text and a vision call are sent as built", async (id) => {
    const service = serviceOf(id)
    const text = await captured(
      (options) =>
        openAiCompatibleText(options).complete({
          system: "Talimat",
          data: JSON.stringify({ data: { title: 'Çelik bıçak "şef"' } }),
          maxTokens: 300,
          json: true,
        }),
      service,
      service.capabilities["text"]
    )
    expect(text.length).toBeGreaterThan(0)
    for (const body of text) {
      expect(rebuilt(body, id, "seo_title", "text")).toEqual(JSON.parse(body))
    }
    const vision = await captured(
      (options) =>
        openAiCompatibleText(options).complete({
          system: "Talimat",
          data: "{}",
          maxTokens: 200,
          images: [picture],
        }),
      service,
      service.capabilities["vision"]
    )
    expect(vision.length).toBeGreaterThan(0)
    for (const body of vision) {
      expect(rebuilt(body, id, "image_alt_text", "vision")).toEqual(JSON.parse(body))
    }
  })

  it.each(["deepseek", "minimax"])("%s: the assistant's turn with its tools", (id) => {
    const body = converseBodyOf(serviceOf(id).capabilities["text"], {
      messages: [
        { role: "system", content: "s" },
        { role: "user", content: "u" },
        {
          role: "assistant",
          content: null,
          toolCalls: [{ id: "c1", name: "find_orders", arguments: '{"q":"x"}' }],
        },
        { role: "tool", toolCallId: "c1", content: "[]" },
      ],
      tools: [
        {
          name: "find_orders",
          description: "d",
          parameters: { type: "object", properties: { q: { type: "string" } } },
        },
      ],
      maxTokens: 1_000,
    })
    expect(rebuilt(body, id, "assistant", "text")).toEqual(JSON.parse(body))
  })

  it("gemini: a picture edited and set in a scene, one candidate asked for", async () => {
    const service = serviceOf("gemini")
    const target = service.capabilities["image_edit"] as { backgrounds: readonly string[] }
    const bodies = await captured(
      async (options) => {
        const connector = geminiImageEdit(options)
        await connector.edit({ image: picture, background: target.backgrounds[0] }).catch(() => 0)
        await connector.scene?.({ image: picture, setting: "ahşap masa" })
      },
      service,
      target
    )
    expect(bodies.length).toBeGreaterThanOrEqual(2)
    for (const [index, body] of bodies.entries()) {
      const sent = JSON.parse(body) as { generationConfig: Record<string, unknown> }
      const task = index < bodies.length / 2 ? "image_background" : "image_scene"
      expect(rebuilt(body, "gemini", task, "image_edit")).toEqual({
        ...sent,
        generationConfig: { ...sent.generationConfig, candidateCount: 1 },
      })
    }
  })

  // Review N1: every type the shop's `imageInputOf` sends passes, in both protocols
  it.each(["image/jpeg", "image/png", "image/webp"])(
    "a %s picture as the shop sends it",
    async (type) => {
      const image = { mimeType: type, bytes: Buffer.from([0xff, 0xd8, 0x00, 0x52, 0x49]) }
      const gemini = serviceOf("gemini")
      const edits = await captured(
        async (options) => {
          const target = gemini.capabilities["image_edit"] as { backgrounds: readonly string[] }
          await geminiImageEdit(options).edit({ image, background: target.backgrounds[0] })
        },
        gemini,
        gemini.capabilities["image_edit"]
      )
      const deepseek = serviceOf("deepseek")
      const vision = await captured(
        (options) =>
          openAiCompatibleText(options).complete({
            system: "s",
            data: "{}",
            maxTokens: 200,
            images: [image],
          }),
        deepseek,
        deepseek.capabilities["vision"]
      )
      expect(edits.length * vision.length).toBeGreaterThan(0)
      for (const body of edits) {
        const sent = JSON.parse(body) as { contents: unknown }
        expect(rebuilt(body, "gemini", "image_background", "image_edit")).toMatchObject({
          contents: sent.contents,
        })
      }
      for (const body of vision) {
        expect(rebuilt(body, "deepseek", "image_alt_text", "vision")).toEqual(JSON.parse(body))
      }
    }
  )
})
