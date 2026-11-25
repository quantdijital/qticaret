import { MedusaError } from "@medusajs/framework/utils"
import { checkProviderKey, checkTargetOf } from "../check"
import type { ProviderFetch } from "../forward"

/**
 * "Bağlantıyı dene" (adr/0085 §2): where a check goes (the table's
 * address, on the service's hosts), the verdicts, and the key zeroed
 * whatever happens.
 */
describe("checkTargetOf", () => {
  it("goes only to the table's https address on the service's hosts", () => {
    expect(checkTargetOf("deepseek")?.url.href).toBe("https://api.deepseek.com/models")
    expect(checkTargetOf("photoroom")).toMatchObject({
      auth: "x-api-key",
      answer: "photoroom_account",
      documented: false,
    })
    expect(checkTargetOf("bria")).toMatchObject({
      auth: "api_token",
      answer: "bria_status",
      documented: false,
    })
    expect(checkTargetOf("bria")?.url.href).toBe(
      "https://engine.prod.bria-api.com/v2/status/qticaret-key-check"
    )
    // Singapore's shared domain only; its model list is not documented: only a 401 refuses
    expect(checkTargetOf("qwen")).toMatchObject({
      auth: "bearer",
      answer: "model_list",
      documented: false,
    })
    expect(checkTargetOf("qwen")?.url.href).toBe(
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models"
    )
    for (const service of ["nobody", "toString", "__proto__", "FAKE"]) {
      expect(checkTargetOf(service)).toBeNull()
    }
  })

  it("reaches the fake service under test on the loopback only", () => {
    const [env, url] = [process.env["NODE_ENV"], process.env["AI_GATEWAY_FAKE_URL"]]
    try {
      process.env["AI_GATEWAY_FAKE_URL"] = "http://127.0.0.1:9/"
      expect(checkTargetOf("fake")?.url.href).toBe("http://127.0.0.1:9/models")
      process.env["AI_GATEWAY_FAKE_URL"] = "http://example.com:9/"
      expect(checkTargetOf("fake")).toBeNull()
      process.env["AI_GATEWAY_FAKE_URL"] = "http://127.0.0.1:9/"
      process.env["NODE_ENV"] = "production"
      expect(checkTargetOf("fake")).toBeNull()
    } finally {
      process.env["NODE_ENV"] = env
      if (url === undefined) {
        Reflect.deleteProperty(process.env, "AI_GATEWAY_FAKE_URL")
      } else {
        process.env["AI_GATEWAY_FAKE_URL"] = url
      }
    }
  })
})

describe("checkProviderKey", () => {
  const opened: Buffer[] = []
  const vault = {
    listSecretRecords: jest.fn(() =>
      Promise.resolve([
        { name: "ai.deepseek.api_key", version: 1, created_at: new Date() },
        { name: "ai.photoroom.api_key", version: 1, created_at: new Date() },
        { name: "ai.bria.api_key", version: 1, created_at: new Date() },
        { name: "ai.qwen.api_key", version: 1, created_at: new Date() },
      ])
    ),
    openSecret: jest.fn(() => {
      const key = Buffer.from(["test", "key", "check", "0123456789"].join("-"))
      opened.push(key)
      return Promise.resolve(key)
    }),
  }
  const logger = { error: jest.fn() }
  const container = { resolve: jest.fn((key: string) => (key === "logger" ? logger : vault)) }
  const answering =
    (status: number, body: string): ProviderFetch =>
    () =>
      Promise.resolve(new Response(body, { status }))
  const throwing =
    (error: Error): ProviderFetch =>
    () =>
      Promise.reject(error)
  const models = JSON.stringify({ object: "list", data: [] })

  afterEach(() => {
    for (const key of opened) {
      expect(key.every((byte) => byte === 0)).toBe(true)
    }
    opened.length = 0
  })

  it("judges an answer without repeating it", async () => {
    const cases: [string, ProviderFetch, unknown][] = [
      ["deepseek", answering(200, models), { ok: true }],
      ["deepseek", answering(401, "Incorrect API key"), { ok: false, reason: "rejected" }],
      ["deepseek", answering(403, "no"), { ok: false, reason: "rejected" }],
      // Photoroom's check is not documented: only a 401 refuses its key
      ["photoroom", answering(403, "no"), { ok: false, reason: "unexpected" }],
      ["photoroom", answering(200, '{"images":{}}'), { ok: true }],
      // Bria's: a request it never had is "not found" to a key it took, 401 to one it refused
      ["bria", answering(404, '{"error":{"code":404}}'), { ok: true }],
      ["bria", answering(404, '{"status":"UNKNOWN"}'), { ok: true }],
      // Only in Bria's own JSON: a proxy's page, an empty or odd 404 is no verdict
      ["bria", answering(404, "<html>Not Found</html>"), { ok: false, reason: "unreachable" }],
      ["bria", answering(404, ""), { ok: false, reason: "unreachable" }],
      ["bria", answering(404, "Not Found"), { ok: false, reason: "unreachable" }],
      ["bria", answering(404, "{}"), { ok: false, reason: "unreachable" }],
      ["bria", answering(404, '{"error":"no"}'), { ok: false, reason: "unreachable" }],
      ["bria", answering(404, "[]"), { ok: false, reason: "unreachable" }],
      ["bria", answering(200, '{"status":"UNKNOWN"}'), { ok: true }],
      ["bria", answering(401, "no"), { ok: false, reason: "rejected" }],
      ["bria", answering(403, "no"), { ok: false, reason: "unexpected" }],
      ["bria", answering(200, "{}"), { ok: false, reason: "unexpected" }],
      // Qwen's model list is not on Model Studio's pages; a 403 there may be an overdue account
      ["qwen", answering(200, models), { ok: true }],
      ["qwen", answering(401, "invalid_api_key"), { ok: false, reason: "rejected" }],
      ["qwen", answering(403, "Arrearage"), { ok: false, reason: "unexpected" }],
      ["qwen", answering(404, ""), { ok: false, reason: "unexpected" }],
      ["deepseek", answering(429, ""), { ok: false, reason: "unreachable" }],
      ["deepseek", answering(502, ""), { ok: false, reason: "unreachable" }],
      ["deepseek", answering(200, "not json"), { ok: false, reason: "unexpected" }],
      ["deepseek", answering(404, models), { ok: false, reason: "unexpected" }],
      [
        "deepseek",
        answering(200, JSON.stringify({ object: "list", data: "x".repeat(600 * 1024) })),
        { ok: false, reason: "unexpected" },
      ],
      [
        "deepseek",
        throwing(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } })),
        { ok: false, reason: "unreachable" },
      ],
      [
        "deepseek",
        throwing(new TypeError("unexpected redirect")),
        { ok: false, reason: "unexpected" },
      ],
    ]
    for (const [service, fetchFn, verdict] of cases) {
      expect(await checkProviderKey(container, service, { fetch: fetchFn })).toEqual(verdict)
    }
  })

  it("sends Bria's key in its api_token header alone", async () => {
    const sent = jest.fn(answering(404, "{}"))
    await checkProviderKey(container, "bria", { fetch: sent })
    const [[url, init]] = sent.mock.calls as unknown as [[URL, RequestInit]]
    expect(url.href).toBe("https://engine.prod.bria-api.com/v2/status/qticaret-key-check")
    expect(Object.keys(init.headers ?? {}).sort()).toEqual(["accept", "api_token"])
  })

  it("says no_key without opening anything, and no_key when the key is gone meanwhile", async () => {
    expect(await checkProviderKey(container, "minimax", { fetch: answering(200, models) })).toEqual(
      {
        ok: false,
        reason: "no_key",
      }
    )
    vault.openSecret.mockRejectedValueOnce(
      new MedusaError(MedusaError.Types.NOT_FOUND, "cp.secret_unknown")
    )
    expect(
      await checkProviderKey(container, "deepseek", { fetch: answering(200, models) })
    ).toEqual({
      ok: false,
      reason: "no_key",
    })
  })

  it("says unexpected when the vault fails otherwise, logging only the error's kind", async () => {
    // PR #374 review Y4: a missing KEK or a broken envelope is not "no key"
    const sent = jest.fn(answering(200, models))
    for (const error of [
      new TypeError("test-secret-detail no KEK"),
      new SyntaxError("test-secret-detail broken envelope"),
    ]) {
      vault.openSecret.mockRejectedValueOnce(error)
      expect(await checkProviderKey(container, "deepseek", { fetch: sent })).toEqual({
        ok: false,
        reason: "unexpected",
      })
    }
    expect(sent).not.toHaveBeenCalled()
    const lines = logger.error.mock.calls.map(([line]) => String(line))
    expect(lines).toEqual([
      'ai.provider_check.vault_failed {"service":"deepseek","err":"TypeError"}',
      'ai.provider_check.vault_failed {"service":"deepseek","err":"SyntaxError"}',
    ])
    expect(lines.join(" ")).not.toContain("test-secret-detail")
  })

  it("says timeout past its time", async () => {
    const hanging: ProviderFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "TimeoutError"))
        })
      })
    expect(
      await checkProviderKey(container, "deepseek", { fetch: hanging, timeoutMs: 20 })
    ).toEqual({ ok: false, reason: "timeout" })
  })
})
