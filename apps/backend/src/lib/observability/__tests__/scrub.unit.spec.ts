import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base"
import { ScrubbingExporter, scrubbedSpan, withoutLiterals } from "../scrub"

// ExportResultCode.SUCCESS, without the SDK's enum package as a dependency
const SUCCESS = { code: 0 } as unknown as Parameters<Parameters<SpanExporter["export"]>[1]>[0]

// Plain values where the SDK has enums (status code): a span as the exporter receives it
const span = (fields: Record<string, unknown>): ReadableSpan =>
  ({
    name: "GET /store/products",
    attributes: {},
    events: [],
    status: { code: 0 },
    spanContext: () => ({ traceId: "t", spanId: "s", traceFlags: 1 }),
    ...fields,
  }) as unknown as ReadableSpan

describe("withoutLiterals", () => {
  it("takes the values out of a statement and keeps its shape", () => {
    expect(
      withoutLiterals(
        `select "c"."id" from "customer" as "c" where "c"."email" = 'ayşe.o''brien@example.com' and "c"."deleted_at" is null limit 1`
      )
    ).toBe(
      `select "c"."id" from "customer" as "c" where "c"."email" = ? and "c"."deleted_at" is null limit ?`
    )
    expect(withoutLiterals(`insert into "t1" ("a") values (E'x\\'y', -42.5, $1)`)).toBe(
      `insert into "t1" ("a") values (?, ?, $1)`
    )
  })
})

describe("scrubbedSpan", () => {
  it("strips SQL literals and redacts every other text, a span's own fields kept", () => {
    const original = span({
      name: "GET /store/gift-cards/GIFT-ABCD-EFGH-JKLM-NPQR",
      attributes: {
        "db.statement": `select * from "customer" where "email" = 'ayse@example.com'`,
        "http.url": "https://magaza.example.com/feeds/tok_123456/google.xml",
        "http.status_code": 200,
      },
      events: [
        {
          name: "exception",
          time: [0, 0],
          attributes: { "exception.message": "ayse@example.com yok" },
        },
      ],
      status: { code: 2, message: "05321234567 aranamadı" },
    })

    const scrubbed = scrubbedSpan(original)

    expect(scrubbed.name).toBe("GET /store/gift-cards/[REDACTED]NPQR")
    expect(scrubbed.attributes).toEqual({
      "db.statement": `select * from "customer" where "email" = ?`,
      "http.url": "https://magaza.example.com/feeds/:token/google.xml",
      "http.status_code": 200,
    })
    expect(scrubbed.events[0]?.attributes?.["exception.message"]).toBe("[REDACTED]@example.com yok")
    expect(scrubbed.status.message).toBe("[REDACTED] aranamadı")
    expect(scrubbed.spanContext().spanId).toBe("s")
    // The span the processor holds is left as it was
    expect(original.attributes["db.statement"]).toContain("ayse@example.com")
  })
})

describe("ScrubbingExporter", () => {
  it("hands the inner exporter scrubbed spans", () => {
    const seen: ReadableSpan[] = []
    const inner = {
      export: (spans: ReadableSpan[], done: Parameters<SpanExporter["export"]>[1]) => {
        seen.push(...spans)
        done(SUCCESS)
      },
      shutdown: () => Promise.resolve(),
    } satisfies SpanExporter
    const done = jest.fn()

    new ScrubbingExporter(inner).export(
      [span({ attributes: { "db.statement": "select 'x'" } })],
      done
    )

    expect(seen[0]?.attributes["db.statement"]).toBe("select ?")
    expect(done).toHaveBeenCalledWith({ code: 0 })
  })
})
