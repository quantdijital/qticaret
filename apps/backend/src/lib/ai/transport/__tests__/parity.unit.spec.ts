import { isProviderError } from "../../../errors/errors"
import type { SafeFetchOptions, SafeFetchResponse } from "../../../security/safe-fetch"
import { textConnectorWith, toolConnectorWith } from "../../connector-of"
import { imageConnectorWith } from "../../image-connector-of"
import { ownKeyTransport } from "../own-key"
import { isAiGatewayRefusal, platformTransport } from "../platform"
import type { AiTransport } from "../types"
import { ENDPOINT, OPERATION, bytesOf, charged, gateway, now, refusal } from "./gateway-fake"

/**
 * adr/0085 §3 (P4a): a connector builds the same body whichever way it
 * is sent; only the transport differs. And on credits it never sends twice.
 */

// Plainly fake: nothing here has the shape of a real key
const KEY = "test-key-parity-not-a-real-one"
const PICTURE = { mimeType: "image/png", bytes: Buffer.from("not-really-a-png") }

const garbage: SafeFetchResponse = {
  status: 200,
  headers: { "content-type": "text/plain" },
  body: Buffer.from("not an answer"),
  url: "https://example.invalid/",
}

interface Sent {
  body: Buffer
  type: string
}

/** The body with its multipart boundary, if any, named the same: each send draws its own. */
function normalized({ body, type }: Sent): string {
  const boundary = /boundary=(.+)$/.exec(type)?.[1]
  const text = body.toString("latin1")
  return boundary ? text.split(boundary).join("BOUNDARY") : text
}

function ownKey(): { transport: AiTransport; sent: Sent[] } {
  const sent: Sent[] = []
  const fetch = (_input: string | URL, options?: SafeFetchOptions) => {
    const headers = options?.headers ?? {}
    const body = options?.body ?? ""
    sent.push({
      body: typeof body === "string" ? Buffer.from(body) : body,
      type: headers["Content-Type"] ?? "",
    })
    return Promise.resolve(garbage)
  }
  return { transport: ownKeyTransport(KEY, { fetch }), sent }
}

function platform(capability: string, service: string, task: string) {
  const { fetch, received } = gateway(
    () => new Response("not an answer", { status: 200, headers: charged(1, 9) })
  )
  const transport = platformTransport({
    task,
    capability,
    service,
    operation: OPERATION,
    endpoint: ENDPOINT,
    fetch,
    now,
  })
  const sent = (): Sent[] =>
    received.map(({ init }) => ({
      body: bytesOf(init.body),
      type: (init.headers as Record<string, string>)["content-type"] ?? "",
    }))
  return { transport, sent }
}

type Run = (transport: AiTransport) => Promise<unknown>

const CASES: [string, string, string, string, Run][] = [
  [
    "text",
    "text",
    "deepseek",
    "seo_title",
    (transport) =>
      textConnectorWith("deepseek", "text", transport, "test").complete({
        system: "Görev.",
        data: '{"a":1}',
        maxTokens: 50,
        json: true,
      }),
  ],
  [
    "pictures read",
    "vision",
    "gemini",
    "image_alt_text",
    (transport) =>
      textConnectorWith("gemini", "vision", transport, "test").complete({
        system: "Görev.",
        data: '{"a":1}',
        maxTokens: 80,
        images: [PICTURE],
      }),
  ],
  [
    "the assistant's tools",
    "text",
    "deepseek",
    "assistant",
    (transport) =>
      toolConnectorWith("deepseek", transport, "test").converse({
        messages: [{ role: "user", content: "kargo" }],
        tools: [
          { name: "find_page", description: "Finds a page.", parameters: { type: "object" } },
        ],
        maxTokens: 100,
      }),
  ],
  [
    "a picture edited, as JSON",
    "image_edit",
    "gemini",
    "image_background",
    (transport) =>
      imageConnectorWith("gemini", transport, "test").edit({ image: PICTURE, background: "white" }),
  ],
  [
    "a picture edited, as multipart",
    "image_edit",
    "photoroom",
    "image_background",
    (transport) =>
      imageConnectorWith("photoroom", transport, "test").edit({
        image: PICTURE,
        background: "white",
      }),
  ],
]

describe("the same body through either transport", () => {
  it.each(CASES)("%s", async (_case, capability, service, task, run) => {
    const own = ownKey()
    const credits = platform(capability, service, task)
    await run(own.transport).catch(() => undefined)
    await run(credits.transport).catch(() => undefined)
    const [byKey] = own.sent
    const [byCredits] = credits.sent()
    if (byKey === undefined || byCredits === undefined) {
      throw new Error("nothing was sent")
    }
    expect(byCredits.body.length).toBeGreaterThan(0)
    expect(normalized(byCredits)).toBe(normalized(byKey))
    expect(byCredits.type.split(";")[0]).toBe(byKey.type.split(";")[0])
  })
})

describe("a connector on credits", () => {
  it("sends once where its own key would try again", async () => {
    const { fetch, received } = gateway(
      () => new Response("busy", { status: 503, headers: charged(0, 9) })
    )
    const transport = platformTransport({
      task: "seo_title",
      capability: "text",
      service: "deepseek",
      operation: OPERATION,
      endpoint: ENDPOINT,
      fetch,
      now,
    })
    const error: unknown = await textConnectorWith("deepseek", "text", transport, "test")
      .complete({ system: "S.", data: "{}", maxTokens: 10 })
      .catch((thrown: unknown) => thrown)
    expect(received).toHaveLength(1)
    expect(isProviderError(error) && error.safeMessage).toBe("ai.provider_unavailable")
  })

  it("passes the gateway's refusal on as it is", async () => {
    const { fetch } = gateway(() => refusal("credits_exhausted"))
    const transport = platformTransport({
      task: "image_background",
      capability: "image_edit",
      service: "photoroom",
      operation: OPERATION,
      endpoint: ENDPOINT,
      fetch,
      now,
    })
    const error: unknown = await imageConnectorWith("photoroom", transport, "test")
      .edit({ image: PICTURE, background: "white" })
      .catch((thrown: unknown) => thrown)
    expect(isAiGatewayRefusal(error)).toBe(true)
    expect(isProviderError(error) && error.safeMessage).toBe("ai.credits_exhausted")
  })
})
