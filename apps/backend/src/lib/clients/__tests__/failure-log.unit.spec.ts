import { runWithRequestContext } from "../../logging"
import { createMemoryFailureLog, worthNoting } from "../failure-log"
import { Item, clientFor, errorOf, json, useProvider } from "./harness"

const provider = useProvider()

function noted() {
  const log = createMemoryFailureLog()
  const { http } = clientFor(provider, {
    failureLog: () => log,
    retry: { attempts: 1 },
  })
  // Notes are written without being waited for: let them land
  const recent = async () => {
    await new Promise((resolve) => setImmediate(resolve))
    return log.recent("acme", 5)
  }
  return { http, recent }
}

describe("the provider failure log", () => {
  it("notes a call given up on with its code, status, path and request ID, newest first", async () => {
    const { http, recent } = noted()
    provider.setHandler(json(500, { error: "down" }))

    await runWithRequestContext({ requestId: "req-12345678" }, () =>
      errorOf(http.request({ path: "/items/1", schema: Item }))
    )
    provider.setHandler(json(401, { error: "who" }))
    await errorOf(http.request({ method: "POST", path: "/orders", json: {}, schema: Item }))

    expect(await recent()).toMatchObject([
      { code: "http_401", status: 401, method: "POST", path: "/orders", request_id: null },
      {
        code: "http_500",
        status: 500,
        method: "GET",
        path: "/items/1",
        request_id: "req-12345678",
      },
    ])
  })

  it("notes an answer that is not what the provider documents", async () => {
    const { http, recent } = noted()
    provider.setHandler(json(200, { unexpected: true }))

    await errorOf(http.request({ path: "/items", schema: Item }))

    expect(await recent()).toMatchObject([{ code: "invalid_response", status: null }])
  })

  it("leaves out the provider's word on what was asked: not found, a conflict, a refused input", async () => {
    const { http, recent } = noted()

    for (const status of [404, 409, 422]) {
      provider.setHandler(json(status, {}))
      await errorOf(http.request({ path: "/items/9", schema: Item }))
    }

    expect(await recent()).toEqual([])
    expect([worthNoting(400), worthNoting(403), worthNoting(null)]).toEqual([true, true, true])
  })

  it("keeps the last twenty of a provider, and only those of the last month", async () => {
    let now = Date.parse("2026-10-30T09:00:00Z")
    const log = createMemoryFailureLog(() => now)
    const failure = (code: string) => ({
      at: new Date(now).toISOString(),
      code,
      status: 500,
      method: "GET",
      path: "/x",
      request_id: null,
    })

    for (let n = 0; n < 25; n++) {
      await log.note("acme", failure(`code_${String(n)}`))
    }
    const kept = await log.recent("acme", 50)
    now += 31 * 24 * 60 * 60 * 1000

    expect(kept).toHaveLength(20)
    expect(kept[0]?.code).toBe("code_24")
    expect(await log.recent("acme", 50)).toEqual([])
    expect(await log.recent("other", 50)).toEqual([])
  })
})
