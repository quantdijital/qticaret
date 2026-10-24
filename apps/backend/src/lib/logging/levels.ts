/**
 * Medusa's level names (npm levels), most to least severe. Kept apart from
 * ./logger.ts so env validation can use them without creating the logger.
 */
export const LOG_LEVELS = ["error", "warn", "info", "http", "verbose", "debug", "silly"] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

// Medusa's own default (LOG_LEVEL || "http")
export const DEFAULT_LOG_LEVEL: LogLevel = "http"

export const isLogLevel = (value: unknown): value is LogLevel =>
  typeof value === "string" && (LOG_LEVELS as readonly string[]).includes(value)
