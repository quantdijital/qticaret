import pino from "pino"
import type { DestinationStream, Logger as PinoLogger } from "pino"
import { errorTrackingFromEnv } from "../error-tracking"
import { currentRequestId } from "./context"
import { DEFAULT_LOG_LEVEL } from "./levels"
import type { LogLevel } from "./levels"
import { redactDeep, redactText } from "./redact"

/**
 * The platform's single logger (docs/10): JSON lines on stdout, redacted
 * (./redact.ts), with the request ID of the current request. Medusa's
 * logger interface is adapted onto it in ./medusa-logger.ts.
 */

// pino has no `http` or `verbose`; they sit between info (30) and debug (20).
// `silly` is pino's trace.
const CUSTOM_LEVELS = { http: 25, verbose: 22 } as const
type CustomLevel = keyof typeof CUSTOM_LEVELS

export type BaseLogger = PinoLogger<CustomLevel>
export type PinoLevel = Exclude<LogLevel, "silly"> | "trace"

export const toPinoLevel = (level: LogLevel): PinoLevel => (level === "silly" ? "trace" : level)

export interface LoggerOptions {
  level?: LogLevel
  /**
   * Defaults to `process.stdout`, not pino's direct fd writer: output then
   * goes through the stream that tests capture (integration-tests/helpers),
   * so a log assertion cannot pass by seeing nothing.
   */
  destination?: DestinationStream
}

// GlitchTip out of reach: said once a minute, below error level so the
// warning never goes to GlitchTip itself (adr/0045)
let lastTrackingFailure = 0
function trackingFailed(reason: string): void {
  const at = Date.now()
  if (at - lastTrackingFailure >= 60_000) {
    lastTrackingFailure = at
    baseLogger.warn({ event: "error_tracking.send_failed", reason }, "error_tracking.send_failed")
  }
}

/** Standard output, and with `ERROR_TRACKING_DSN` the error lines to GlitchTip too. */
function defaultDestination(): DestinationStream {
  const tracking = errorTrackingFromEnv(process.env, trackingFailed)
  if (!tracking) {
    return process.stdout
  }
  return pino.multistream(
    [
      { level: "trace", stream: process.stdout },
      { level: "error", stream: tracking },
    ],
    { levels: { ...pino.levels.values, ...CUSTOM_LEVELS } }
  )
}

export function createPinoLogger(options: LoggerOptions = {}): BaseLogger {
  return pino<CustomLevel>(
    {
      level: toPinoLevel(options.level ?? DEFAULT_LOG_LEVEL),
      customLevels: CUSTOM_LEVELS,
      timestamp: pino.stdTimeFunctions.isoTime,
      // Errors are flattened and redacted by `redactDeep`; pino's own error
      // serializer would re-serialize the flat copy as a plain Object
      serializers: { err: (value: unknown) => value },
      formatters: {
        level: (label) => ({ level: label }),
        log: (object) => redactDeep(object) as Record<string, unknown>,
      },
      mixin: () => {
        const requestId = currentRequestId()
        return requestId === undefined ? {} : { request_id: requestId }
      },
      // The message is not part of the object `formatters.log` sees
      hooks: {
        logMethod(args, method) {
          const redacted = args.map((arg: unknown) =>
            typeof arg === "string" ? redactText(arg) : arg
          ) as typeof args
          method.apply(this, redacted)
        },
      },
    },
    options.destination ?? defaultDestination()
  )
}

/** Structured fields of a log line; `event` names what happened (`bootstrap.region_created`). */
export interface LogFields {
  event: string
  [field: string]: unknown
}

type LogMethod = (fields: LogFields, message?: string) => void

export interface StructuredLogger {
  error: LogMethod
  warn: LogMethod
  info: LogMethod
  debug: LogMethod
}

// Without a message pino would copy `err.message` into the line unredacted
// by the message hook, so the event name stands in
export function createStructuredLogger(base: BaseLogger): StructuredLogger {
  return {
    error: (fields, message) => {
      base.error(fields, message ?? fields.event)
    },
    warn: (fields, message) => {
      base.warn(fields, message ?? fields.event)
    },
    info: (fields, message) => {
      base.info(fields, message ?? fields.event)
    },
    debug: (fields, message) => {
      base.debug(fields, message ?? fields.event)
    },
  }
}

/** Shared by Medusa (through the adapter in medusa-config.ts) and platform code. */
export const baseLogger = createPinoLogger()
export const logger = createStructuredLogger(baseLogger)
