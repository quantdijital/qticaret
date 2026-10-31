import { registerOtel } from "@medusajs/medusa"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { ScrubbingExporter } from "./src/lib/observability/scrub"

/**
 * Traces (F15.4, adr/0045): Medusa's OpenTelemetry hook, on only when an
 * OTLP collector is set (`OTEL_EXPORTER_OTLP_ENDPOINT`, self-hosted in
 * Türkiye), so development and tests carry no tracing. The exporter reads
 * the endpoint itself and posts to its `/v1/traces`. Spans leave in batches:
 * given only an exporter, each span went out in a request of its own (about
 * fifty for one store request). Sampling follows OpenTelemetry's own
 * variables (`OTEL_TRACES_SAMPLER=parentbased_traceidratio`,
 * `OTEL_TRACES_SAMPLER_ARG=0.1`), batching `OTEL_BSP_*`.
 *
 * What a trace holds: request method, route and status (query values
 * redacted by Medusa except paging and field lists), workflow and step
 * names, Query entities, cache keys, SQL text. The ORM writes values into
 * the SQL text (an e-mail looked up was found in a span, the F15 security
 * review), so every span leaves through `ScrubbingExporter`: SQL without
 * its literals, every other text through the logs' redaction. No headers
 * and no bodies.
 */
export function register() {
  if (!process.env["OTEL_EXPORTER_OTLP_ENDPOINT"]) {
    return
  }
  registerOtel({
    serviceName: process.env["OTEL_SERVICE_NAME"] ?? "qticaret-backend",
    spanProcessors: [new BatchSpanProcessor(new ScrubbingExporter(new OTLPTraceExporter()))],
    instrument: { http: true, workflows: true, query: true, db: true, cache: true },
  })
}
