import { runWithRequestContext } from "../context"
import { createStructuredLogger } from "../logger"
import { REDACTED } from "../redact"
import { captureLogger } from "./capture"

describe("createPinoLogger", () => {
  it("writes one JSON line with a level label, ISO time and the fields", () => {
    const { base, lines } = captureLogger()

    createStructuredLogger(base).info(
      { event: "bootstrap.region_created", regionId: "reg_1" },
      "done"
    )

    expect(lines()).toHaveLength(1)
    expect(lines()[0]).toMatchObject({
      level: "info",
      event: "bootstrap.region_created",
      regionId: "reg_1",
      msg: "done",
    })
    expect(lines()[0]?.["time"]).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/))
  })

  it("adds the request ID of the current request context", () => {
    const { base, lines } = captureLogger()
    const log = createStructuredLogger(base)

    runWithRequestContext({ requestId: "req-12345678" }, () => {
      log.info({ event: "inside" })
    })
    log.info({ event: "outside" })

    expect(lines()[0]).toMatchObject({ event: "inside", request_id: "req-12345678" })
    expect(lines()[1]).not.toHaveProperty("request_id")
  })

  it("keeps the request ID across async continuations", async () => {
    const { base, lines } = captureLogger()
    const log = createStructuredLogger(base)

    await runWithRequestContext({ requestId: "req-async-1" }, async () => {
      await new Promise((resolve) => setImmediate(resolve))
      log.info({ event: "after_await" })
    })

    expect(lines()[0]).toMatchObject({ request_id: "req-async-1" })
  })

  it("redacts sensitive fields and patterns in the message", () => {
    const { base, lines, raw } = captureLogger()

    createStructuredLogger(base).warn(
      { event: "provider.call", headers: { authorization: "Bearer live-123" }, apiKey: "k-1" },
      "calling postgres://user:pw@db/x for ayse@example.com"
    )

    expect(lines()[0]).toMatchObject({
      headers: { authorization: REDACTED },
      apiKey: REDACTED,
      msg: `calling postgres://${REDACTED}@db/x for ${REDACTED}@example.com`,
    })
    expect(raw()).not.toMatch(/live-123|k-1|pw@|ayse@/)
  })

  it("flattens an error with its redacted cause", () => {
    const { base, lines, raw } = captureLogger()
    const error = new Error("payment failed", { cause: { response: { secretKey: "sk-9" } } })

    createStructuredLogger(base).error({ event: "payment.failed", err: error })

    expect(lines()[0]).toMatchObject({
      err: {
        name: "Error",
        message: "payment failed",
        cause: { response: { secretKey: REDACTED } },
      },
    })
    expect(raw()).not.toContain("sk-9")
  })

  it("uses the event as the message so pino never copies err.message", () => {
    const { base, lines, raw } = captureLogger()
    const error = new Error(`insert into "customer" ("email") values ('ayse@example.com') - boom`)

    createStructuredLogger(base).error({ event: "db.failed", err: error })

    expect(lines()[0]).toMatchObject({ msg: "db.failed", err: { message: "[SQL] boom" } })
    expect(raw()).not.toContain("ayse")
  })

  it("strips SQL from the message too", () => {
    const { base, lines } = captureLogger()

    base.error(`update "customer" set "first_name" = 'Ayşe' where "id" = 'c1' - deadlock`)

    expect(lines()[0]).toMatchObject({ msg: "[SQL] deadlock" })
  })

  it("keeps every line valid JSON when values hold escapes and numbers", () => {
    const { base, raw } = captureLogger()

    createStructuredLogger(base).info({
      event: "x",
      note: "a\nayse@example.com",
      bytes: 5368709120,
    })

    expect(() => JSON.parse(raw()) as unknown).not.toThrow()
    expect(raw()).not.toContain("ayse@")
  })

  it("respects the level", () => {
    const { base, lines } = captureLogger("warn")

    createStructuredLogger(base).info({ event: "skipped" })

    expect(lines()).toHaveLength(0)
  })
})
