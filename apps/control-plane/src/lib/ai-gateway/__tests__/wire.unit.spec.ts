import { answerContentType, callParamsOf, providerHeaders } from "../headers"
import { forwardCall, notTaken } from "../forward"
import type { ForwardOutcome, ProviderFetch } from "../forward"
import { measuresOf } from "../measures"
import { FAKE_URL_ENV, gatewayTargetOf } from "../target"
import type { GatewayTarget } from "../target"

const KEY = ["test", "key", "wire", "0000"].join("-")
const OP = "6f0c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f"

const must = (value: GatewayTarget | null): GatewayTarget => {
  if (value === null) {
    throw new Error("no target")
  }
  return value
}

describe("the gateway's wire (adr/0085 §2, Güvenlik)", () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
  })

  it("reads the call's four values from the signed target's query, nothing else", () => {
    const path = "/tenant-api/v1/ai/calls"
    const query = `task=seo_title&capability=text&service=deepseek&operation=${OP}`
    expect(callParamsOf(`${path}?${query}`)).toEqual({
      task: "seo_title",
      capability: "text",
      service: "deepseek",
      operation: OP,
    })
    expect(callParamsOf(`http://cp.example${path}?${query}`)?.task).toBe("seo_title")
    expect(callParamsOf(path)).toBeNull()
    expect(callParamsOf(`${path}?${query.replace(OP, "not-a-uuid")}`)).toBeNull()
    expect(callParamsOf(`${path}?${query}&task=post_draft`)).toBeNull()
    expect(callParamsOf(`${path}?${query}&model=big`)).toBeNull()
    expect(callParamsOf(`${path}?${query.replace("&service=deepseek", "")}`)).toBeNull()
  })

  it("sends three headers: the type, accept, and the key in its service's header", () => {
    const key = Buffer.from(KEY)
    expect(providerHeaders("bearer", key, "application/json")).toEqual({
      "content-type": "application/json",
      accept: "application/json, image/*",
      authorization: `Bearer ${KEY}`,
    })
    expect(
      Object.keys(providerHeaders("x-api-key", key, "multipart/form-data; boundary=b"))
    ).toEqual(["content-type", "accept", "x-api-key"])
    expect(providerHeaders("x-goog-api-key", key, "application/json")["x-goog-api-key"]).toBe(KEY)
    expect(providerHeaders("api_token", key, "application/json")).toEqual({
      "content-type": "application/json",
      accept: "application/json, image/*",
      api_token: KEY,
    })
  })

  it("passes a plain answer type on, anything odd as octet-stream", () => {
    expect(answerContentType("application/json; charset=utf-8")).toBe(
      "application/json; charset=utf-8"
    )
    expect(answerContentType("image/png")).toBe("image/png")
    for (const odd of [null, "", "text/html\r\nset-cookie: a=b", "x".repeat(300), "nonsense"]) {
      expect(answerContentType(odd)).toBe("application/octet-stream")
    }
  })

  it("takes an address from the table alone, https on its hosts, no key in it", () => {
    const gemini = must(gatewayTargetOf("gemini", "image_edit", "image_background"))
    expect(gemini.url.href).toBe(
      "https://generativelanguage.googleapis.com/v1/models/gemini-nano-banana-2.1:generateContent"
    )
    expect(gemini.url.search).toBe("")
    expect(gemini.auth).toBe("x-goog-api-key")
    const scene = must(gatewayTargetOf("photoroom", "image_edit", "image_scene"))
    expect([scene.url.href, scene.model]).toEqual([
      "https://image-api.photoroom.com/v2/edit",
      "edit-v2-ai-background",
    ])
    expect(gatewayTargetOf("photoroom", "text", "seo_title")).toBeNull()
    const cut = must(gatewayTargetOf("bria", "image_edit", "image_background"))
    expect([cut.url.href, cut.model, cut.auth, cut.fixedBody]).toEqual([
      "https://engine.prod.bria-api.com/v2/image/edit/remove_background",
      "RMBG2",
      "api_token",
      { model: "RMBG2", sync: true },
    ])
    // The scene's own fixed fields, not the cut-out's
    const briaScene = must(gatewayTargetOf("bria", "image_edit", "image_scene"))
    expect([briaScene.url.href, briaScene.model, briaScene.fixedBody]).toEqual([
      "https://engine.prod.bria-api.com/v2/image/edit/replace_background",
      "fibo2",
      { mode: "fibo2", original_quality: true, sync: true },
    ])
    expect(gatewayTargetOf("openai", "text", "seo_title")).toBeNull()
    expect(gatewayTargetOf("__proto__", "text", "seo_title")).toBeNull()
  })

  it("reaches the fake service only under test, on the loopback", () => {
    process.env[FAKE_URL_ENV] = "http://127.0.0.1:9/"
    expect(must(gatewayTargetOf("fake", "text", "seo_title")).url.href).toBe(
      "http://127.0.0.1:9/chat"
    )
    process.env[FAKE_URL_ENV] = "http://example.com:9/"
    expect(gatewayTargetOf("fake", "text", "seo_title")).toBeNull()
    process.env[FAKE_URL_ENV] = "http://127.0.0.1:9/"
    for (const nodeEnv of ["production", "development", "staging"]) {
      process.env["NODE_ENV"] = nodeEnv
      expect(gatewayTargetOf("fake", "text", "seo_title")).toBeNull()
    }
  })

  const deepseek = must(gatewayTargetOf("deepseek", "text", "seo_title"))
  const minimax = must(gatewayTargetOf("minimax", "text", "seo_title"))
  const answered = (status: number, body = "{}"): ForwardOutcome => ({
    kind: "answered",
    status,
    contentType: "application/json",
    body: Buffer.from(body),
  })

  it("gives back only what the provider never took (the shop's notTakenByService)", () => {
    for (const status of [401, 402, 403, 429, 500, 502, 503]) {
      expect(notTaken(answered(status), deepseek)).toBe(true)
    }
    for (const status of [200, 400, 408, 413, 422]) {
      expect(notTaken(answered(status), deepseek)).toBe(false)
    }
    // The platform's own failure (D3): a model gone, its key refused in a 400
    expect(notTaken(answered(404), deepseek)).toBe(true)
    const keyRefused = '{"error":{"message":"API key not valid.","code":"invalid_api_key"}}'
    expect(notTaken(answered(400, keyRefused), deepseek)).toBe(true)
    // Its words alone are no proof (second review N5): the provider may echo the shop's input
    expect(notTaken(answered(400, '{"error":{"message":"API key not valid."}}'), deepseek)).toBe(
      false
    )
    expect(notTaken({ kind: "not_connected", code: "connect_failed" }, deepseek)).toBe(true)
    expect(notTaken({ kind: "timeout", code: "timeout" }, deepseek)).toBe(false)
    expect(notTaken({ kind: "failed", code: "answer_cut" }, deepseek)).toBe(false)
    // MiniMax's 200 with a code of no work done; another code keeps the charge
    const coded = (code: number) => JSON.stringify({ base_resp: { status_code: code } })
    expect(notTaken(answered(200, coded(1008)), minimax)).toBe(true)
    expect(notTaken(answered(200, coded(1026)), minimax)).toBe(false)
    expect(notTaken(answered(200, coded(1008)), deepseek)).toBe(false)
  })

  const call = (fetch: ProviderFetch, maxAnswerBytes = 1024, timeoutMs = 1_000) =>
    forwardCall({
      target: deepseek,
      key: Buffer.from(KEY),
      body: Buffer.from("{}"),
      contentType: "application/json",
      timeoutMs,
      maxAnswerBytes,
      fetch,
    })

  it("posts once, no redirect followed, and reads the answer to its cap", async () => {
    const seen: RequestInit[] = []
    const ok = await call((url, init) => {
      seen.push(init)
      expect(url.href).toBe("https://api.deepseek.com/chat/completions")
      return Promise.resolve(
        new Response("hello", { status: 201, headers: { "content-type": "application/json" } })
      )
    })
    expect(ok).toMatchObject({ kind: "answered", status: 201, contentType: "application/json" })
    expect(ok.kind === "answered" && ok.body.toString()).toBe("hello")
    expect(seen[0]).toMatchObject({ method: "POST", redirect: "error" })
    // A success the shop cannot read (D2) is no answer; a failure keeps its type to be rewritten
    const typed = (status: number, type: string) =>
      call(() => Promise.resolve(new Response("x", { status, headers: { "content-type": type } })))
    expect(await typed(200, "text/html")).toEqual({ kind: "failed", code: "answer_type" })
    expect(await typed(500, "text/html")).toMatchObject({ kind: "answered", status: 500 })
    expect(await call(() => Promise.resolve(new Response("x".repeat(2000))))).toEqual({
      kind: "failed",
      code: "answer_too_large",
    })
  })

  it("tells a refused connection from a timeout and from a reset, quoting none", async () => {
    const thrown =
      (code: string): ProviderFetch =>
      () =>
        Promise.reject(Object.assign(new TypeError(`fetch failed ${KEY}`), { cause: { code } }))
    expect(await call(thrown("ECONNREFUSED"))).toEqual({
      kind: "not_connected",
      code: "connect_failed",
    })
    expect(await call(thrown("ECONNRESET"))).toEqual({ kind: "failed", code: "request_failed" })
    const slow: ProviderFetch = (_, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"))
        })
      })
    expect(await call(slow, 1024, 20)).toEqual({ kind: "timeout", code: "timeout" })
  })

  it("measures tokens and the estimated cost, rounded up; pictures by the image", () => {
    const answer = {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify({ usage: { prompt_tokens: 1000, completion_tokens: 10 } })),
    }
    expect(measuresOf(deepseek, answer, 0)).toEqual({
      service: "deepseek",
      model: "deepseek-flash",
      inputTokens: 1000,
      outputTokens: 10,
      images: null,
      // 1000 × 0.30 $ + 10 × 1.20 $ per million: 312 millionths
      estimatedCostMicros: 312,
    })
    const photoroom = must(gatewayTargetOf("photoroom", "image_edit", "image_scene"))
    expect(
      measuresOf(photoroom, { contentType: "image/png", body: Buffer.from("png") }, 1)
    ).toMatchObject({ images: 1, estimatedCostMicros: 100_000 })
    const bria = must(gatewayTargetOf("bria", "image_edit", "image_scene"))
    const named = (body: unknown) => ({
      contentType: "application/json",
      body: Buffer.from(JSON.stringify(body)),
    })
    expect(
      measuresOf(bria, named({ result: { image_url: "https://x/r.png" }, request_id: "r" }), 1)
    ).toMatchObject({ model: "fibo2", images: 1, estimatedCostMicros: 32_000 })
    expect(measuresOf(bria, named({ request_id: "r", status_url: "https://x" }), 1)).toMatchObject({
      images: null,
      estimatedCostMicros: null,
    })
    expect(
      measuresOf(deepseek, { contentType: "text/plain", body: Buffer.from("x") }, 0)
    ).toMatchObject({ inputTokens: null, estimatedCostMicros: null })
  })
})
