import { createErrorTrackingStream, eventOf, framesOf, parseDsn } from ".."
import type { ErrorTrackingDsn } from ".."

const ROOT = "/srv/app"
const context = { environment: "staging", serverName: "magaza.example", root: ROOT }

const stack = [
  "Error: siparis bulunamadi",
  "    at findOrder (/srv/app/src/workflows/orders/find.ts:12:9)",
  "    at /srv/app/node_modules/@medusajs/framework/dist/http.js:40:3",
  "    at async run (node:internal/process/task_queues:95:5)",
].join("\n")

const line = (fields: Record<string, unknown>) =>
  JSON.stringify({ level: "error", time: "2026-10-31T08:00:00.000Z", ...fields })

describe("parseDsn", () => {
  it("reads GlitchTip's DSN, a path before the project included", () => {
    expect(parseDsn("https://abc123@hata.example.com/7")).toEqual({
      dsn: "https://abc123@hata.example.com/7",
      publicKey: "abc123",
      envelopeUrl: "https://hata.example.com/api/7/envelope/",
    })
    expect(parseDsn("https://abc@hata.example.com/glitchtip/7")?.envelopeUrl).toBe(
      "https://hata.example.com/glitchtip/api/7/envelope/"
    )
  })

  it("takes plain http on a loopback address only", () => {
    expect(parseDsn("http://abc@127.0.0.1:9107/1")).not.toBeNull()
    expect(parseDsn("http://abc@hata.example.com/1")).toBeNull()
  })

  it.each(["https://hata.example.com/7", "https://abc@hata.example.com/", "nonsense"])(
    "refuses %s",
    (value) => {
      expect(parseDsn(value)).toBeNull()
    }
  )
})

describe("eventOf", () => {
  it("names the failure, its frames oldest first, and the request", () => {
    const event = eventOf(
      {
        level: "error",
        time: "2026-10-31T08:00:00.000Z",
        event: "http.request_failed",
        request_id: "req_1",
        method: "POST",
        path: "/store/carts/:id/complete",
        status: 500,
        err: { name: "Error", message: "siparis bulunamadi", stack },
      },
      context
    )
    expect(event).toMatchObject({
      level: "error",
      environment: "staging",
      server_name: "magaza.example",
      transaction: "POST /store/carts/:id/complete",
      tags: { event: "http.request_failed", request_id: "req_1", method: "POST", status: "500" },
      fingerprint: ["http.request_failed", "Error", "src/workflows/orders/find.ts:findOrder"],
    })
    const frames = event?.exception?.values[0]?.stacktrace?.frames ?? []
    expect(frames.map((frame) => [frame.filename, frame.in_app])).toEqual([
      ["node:internal/process/task_queues", false],
      ["node_modules/@medusajs/framework/dist/http.js", false],
      ["src/workflows/orders/find.ts", true],
    ])
    expect(event?.event_id).toMatch(/^[0-9a-f]{32}$/)
  })

  it("keeps nothing of the line but what names the failure", () => {
    const event = eventOf(
      { level: "error", event: "jobs.failed", ...{ email: "ayse@example.com", cart: "x" } },
      context
    )
    expect(JSON.stringify(event)).not.toContain("ayse@example.com")
    expect(event?.message).toEqual({ formatted: "jobs.failed" })
  })

  it("leaves lines below error level alone", () => {
    expect(eventOf({ level: "warn", event: "x" }, context)).toBeNull()
    expect(eventOf({ level: "fatal", event: "x" }, context)?.level).toBe("fatal")
  })

  it("reads both of V8's frame forms", () => {
    expect(framesOf("    at /srv/app/a.ts:1:2\n    at fn (/srv/app/b.ts:3:4)", ROOT)).toEqual([
      { function: "fn", filename: "b.ts", lineno: 3, colno: 4, in_app: true },
      { filename: "a.ts", lineno: 1, colno: 2, in_app: true },
    ])
  })
})

describe("createErrorTrackingStream", () => {
  const read = parseDsn("https://abc123@hata.example.com/7")
  if (!read) {
    throw new Error("the test DSN does not parse")
  }
  const dsn: ErrorTrackingDsn = read

  function setup(options: { ok?: boolean; maxPending?: number } = {}) {
    const sent: { url: string; init: RequestInit }[] = []
    const failures: string[] = []
    let clock = 0
    const fetch = ((url: string, init: RequestInit) => {
      sent.push({ url, init })
      return Promise.resolve({ ok: options.ok ?? true, status: options.ok === false ? 429 : 200 })
    }) as unknown as typeof globalThis.fetch
    const stream = createErrorTrackingStream({
      dsn,
      context,
      fetch,
      now: () => clock,
      onFailure: (reason) => failures.push(reason),
      ...(options.maxPending === undefined ? {} : { maxPending: options.maxPending }),
    })
    return { stream, sent, failures, tick: (ms: number) => (clock += ms) }
  }

  it("sends an error line as an envelope GlitchTip reads", async () => {
    const { stream, sent } = setup()
    stream.write(
      line({ event: "http.request_failed", err: { name: "Error", message: "x", stack } })
    )
    await stream.flush()
    expect(sent).toHaveLength(1)
    expect(sent[0]?.url).toBe("https://hata.example.com/api/7/envelope/")
    const headers = sent[0]?.init.headers as Record<string, string>
    expect(headers["x-sentry-auth"]).toContain("sentry_key=abc123")
    const body = sent[0]?.init.body
    const [envelope, item, payload] = (typeof body === "string" ? body : "").split("\n")
    expect(JSON.parse(envelope ?? "")).toMatchObject({ dsn: dsn.dsn })
    expect(JSON.parse(item ?? "")).toEqual({
      type: "event",
      content_type: "application/json",
      length: Buffer.byteLength(payload ?? ""),
    })
    expect(JSON.parse(payload ?? "")).toMatchObject({ tags: { event: "http.request_failed" } })
  })

  it("sends a failure once a minute, and leaves warnings and its own events out", async () => {
    const { stream, sent, tick } = setup()
    const failure = line({ event: "jobs.failed", err: { name: "Error", message: "a", stack } })
    stream.write(failure)
    stream.write(failure)
    stream.write(line({ level: "warn", event: "jobs.slow" }))
    stream.write(line({ event: "error_tracking.send_failed" }))
    stream.write("not json")
    tick(60_000)
    stream.write(failure)
    await stream.flush()
    expect(sent).toHaveLength(2)
  })

  it("drops what is past its queue, and reports a refusal without throwing", async () => {
    const { stream, sent, failures } = setup({ ok: false, maxPending: 2 })
    for (const name of ["a", "b", "c"]) {
      stream.write(line({ event: `jobs.${name}` }))
    }
    await stream.flush()
    expect(sent).toHaveLength(2)
    expect(failures).toEqual(["http_429", "http_429"])
  })
})
