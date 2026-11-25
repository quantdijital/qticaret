import { AI_SERVICE_TARGETS } from "@qticaret/types/control-plane"
import { isProviderError } from "../../../errors/errors"
import { SafeFetchError } from "../../../security/safe-fetch"
import type { SafeFetchOptions, SafeFetchResponse } from "../../../security/safe-fetch"
import { findAiService } from "../../registry/services"
import type { AiService, ImageEditTarget, OpenAiCompatibleTarget } from "../../registry/services"
import { authOf, ownKeyTransport } from "../own-key"
import type { AiTransportRequest } from "../types"

/** adr/0085 §3 (P4a): the shop's own key, exactly as the connectors always sent it. */

// Plainly fake: nothing here has the shape of a real key
const KEY = "test-key-own-not-a-real-one"

function targetOf(id: string, capability: "text" | "image_edit") {
  const service = findAiService(id, "test")
  const target = service?.capabilities[capability]
  if (!service || !target || (target.connector !== "openai-compatible" && capability === "text")) {
    throw new Error(`no ${capability} target for ${id}`)
  }
  return { service, target: target as OpenAiCompatibleTarget | ImageEditTarget }
}

const ok: SafeFetchResponse = {
  status: 200,
  headers: { "content-type": "application/json", "retry-after": "3", "set-cookie": ["a=b"] },
  body: Buffer.from("{}"),
  url: "https://example.invalid/",
}

function recorder(answer: SafeFetchResponse | Error = ok) {
  const sent: { url: string; options: SafeFetchOptions }[] = []
  const fetch = (input: string | URL, options?: SafeFetchOptions) => {
    sent.push({ url: String(input), options: options ?? {} })
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
  }
  return { fetch, sent }
}

function requestTo(
  to: { service: AiService; target: OpenAiCompatibleTarget | ImageEditTarget },
  url: string,
  headers: Record<string, string> = { "Content-Type": "application/json" }
): AiTransportRequest {
  return {
    to: { ...to, url: new URL(url) },
    method: "POST",
    body: "{}",
    headers,
    timeoutMs: 1_000,
    maxResponseBytes: 1024,
    signal: new AbortController().signal,
  }
}

describe("own key transport", () => {
  it.each([
    [
      "deepseek",
      "text",
      "https://api.deepseek.com/chat/completions",
      "Authorization",
      `Bearer ${KEY}`,
    ],
    ["photoroom", "image_edit", "https://sdk.photoroom.com/v1/segment", "x-api-key", KEY],
    [
      "bria",
      "image_edit",
      "https://engine.prod.bria-api.com/v2/image/edit/remove_background",
      "api_token",
      KEY,
    ],
    [
      "gemini",
      "image_edit",
      "https://generativelanguage.googleapis.com/v1/models/x:generateContent",
      "x-goog-api-key",
      KEY,
    ],
  ] as const)(
    "%s %s: the key in %s, first, and only there",
    async (id, capability, url, header, value) => {
      const { fetch, sent } = recorder()
      const transport = ownKeyTransport(KEY, { fetch })
      await transport.send(
        requestTo(targetOf(id, capability), url, { "Content-Type": "x/y", Accept: "*/*" })
      )
      const [first] = sent
      expect(Object.entries(first?.options.headers ?? {})).toEqual([
        [header, value],
        ["Content-Type", "x/y"],
        ["Accept", "*/*"],
      ])
      expect(first?.url).toBe(url)
      expect(first?.options).toMatchObject({ method: "POST", body: "{}", redirect: "error" })
      expect(first?.options).toMatchObject({ timeoutMs: 1_000, maxResponseBytes: 1024 })
    }
  )

  it("names each target's credential header as the shared table does", () => {
    for (const [id, table] of Object.entries(AI_SERVICE_TARGETS)) {
      const service = findAiService(id, "test")
      const shared: Partial<Record<string, { auth: string }>> = table.capabilities
      for (const capability of ["text", "vision", "image_edit"] as const) {
        const auth = shared[capability]?.auth
        const target = service?.capabilities[capability]
        if (auth === undefined) {
          continue
        }
        if (
          target === undefined ||
          target.connector === "fake" ||
          target.connector === "fake-image"
        ) {
          throw new Error(`${id} ${capability}: no networked target`)
        }
        expect([id, capability, authOf(target)]).toEqual([id, capability, auth])
      }
    }
  })

  it("never passes a credential a caller put among its headers", async () => {
    const { fetch, sent } = recorder()
    await ownKeyTransport(KEY, { fetch }).send(
      requestTo(targetOf("photoroom", "image_edit"), "https://sdk.photoroom.com/v1/segment", {
        authorization: "Bearer test-key-other",
        "X-Api-Key": "test-key-other",
        "x-goog-api-key": "test-key-other",
        Api_Token: "test-key-other",
        Accept: "*/*",
      })
    )
    expect(JSON.stringify(sent)).not.toContain("test-key-other")
  })

  it.each([
    "https://evil.example/chat/completions",
    "http://api.deepseek.com/chat/completions",
    "https://api.deepseek.com/chat/completions?x=1",
    "https://user:pw@api.deepseek.com/chat/completions",
  ])("refuses an address off the registry's hosts: %s", async (url) => {
    const { fetch, sent } = recorder()
    const error: unknown = await ownKeyTransport(KEY, { fetch })
      .send(requestTo(targetOf("deepseek", "text"), url))
      .catch((thrown: unknown) => thrown)
    expect(isProviderError(error)).toBe(true)
    expect(isProviderError(error) && error.safeMessage).toBe("ai.provider_response_invalid")
    expect(isProviderError(error) && error.providerCode).toBe("endpoint_not_registered")
    expect(sent).toHaveLength(0)
  })

  it("gives back the status, the body and only the headers a connector reads", async () => {
    const { fetch } = recorder()
    const answer = await ownKeyTransport(KEY, { fetch }).send(
      requestTo(targetOf("deepseek", "text"), "https://api.deepseek.com/chat/completions")
    )
    expect(answer).toEqual({
      status: 200,
      headers: { "content-type": "application/json", "retry-after": "3" },
      body: Buffer.from("{}"),
    })
  })

  it("throws safeFetch's refusal of a redirect as it is, for the connector to map", async () => {
    const refusal = new SafeFetchError("redirect_not_allowed")
    const { fetch } = recorder(refusal)
    const error: unknown = await ownKeyTransport(KEY, { fetch })
      .send(requestTo(targetOf("deepseek", "text"), "https://api.deepseek.com/chat/completions"))
      .catch((thrown: unknown) => thrown)
    expect(error).toBe(refusal)
  })

  it("allows the connector its one retry and names its funding", () => {
    const transport = ownKeyTransport(KEY)
    expect([transport.funding, transport.retries]).toEqual(["own_key", true])
  })
})
