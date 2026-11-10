import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base"
import { redactText } from "@qticaret/server-kit"

/**
 * Traces leave as a log line does (adr/0045, the F15 security review):
 * - SQL text without its literals: the ORM writes the values into the
 *   statement itself, an e-mail or an address among them;
 * - every other text (span names, routes, URLs, error messages) through
 *   the logs' redaction (e-mails, phones, T.C. numbers, keys, a gift
 *   card's code in its path), a feed's token kept out of its path.
 */

const SQL_KEYS = new Set(["db.statement", "db.query.text"])
// A feed's address carries its token (F10.8), as the logs keep it out
const FEED_PATH = /\/feeds\/[^/?#\s"]+/g

/** A statement's shape: its string and number literals as `?`. */
export function withoutLiterals(sql: string): string {
  return (
    sql
      // E'…' takes backslash escapes; '…' doubles its quotes
      .replace(/[Ee]'(?:[^'\\]|\\.|'')*'/g, "?")
      .replace(/'(?:[^']|'')*'/g, "?")
      .replace(/(?<![\w$.])-?\d+(?:\.\d+)?\b/g, "?")
  )
}

const scrubText = (text: string) => redactText(text).replace(FEED_PATH, "/feeds/:token")

function scrubValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    return SQL_KEYS.has(key) ? scrubText(withoutLiterals(value)) : scrubText(value)
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => (typeof item === "string" ? scrubText(item) : item))
  }
  return value
}

const scrubAttributes = <T extends Record<string, unknown>>(attributes: T): T =>
  Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [key, scrubValue(key, value)])
  ) as T

/** The span as it may leave: its own fields kept, its texts scrubbed. */
export function scrubbedSpan(span: ReadableSpan): ReadableSpan {
  return Object.create(span, {
    name: { value: scrubText(span.name), enumerable: true },
    attributes: { value: scrubAttributes(span.attributes), enumerable: true },
    events: {
      value: span.events.map((event) =>
        event.attributes ? { ...event, attributes: scrubAttributes(event.attributes) } : event
      ),
      enumerable: true,
    },
    status: {
      value: span.status.message
        ? { ...span.status, message: scrubText(span.status.message) }
        : span.status,
      enumerable: true,
    },
  }) as ReadableSpan
}

/** An exporter that sends every span scrubbed (`scrubbedSpan`). */
export class ScrubbingExporter implements SpanExporter {
  constructor(private readonly inner: SpanExporter) {}

  export(spans: ReadableSpan[], done: Parameters<SpanExporter["export"]>[1]): void {
    this.inner.export(spans.map(scrubbedSpan), done)
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown()
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush ? this.inner.forceFlush() : Promise.resolve()
  }
}
