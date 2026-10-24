import type { DestinationStream } from "pino"
import { createPinoLogger } from "../logger"
import type { LogLevel } from "../levels"
import type { BaseLogger } from "../logger"

export interface CapturedLogger {
  base: BaseLogger
  /** Every line written so far, parsed. */
  lines: () => Record<string, unknown>[]
  /** The raw output, for "never appears" assertions. */
  raw: () => string
}

export function captureLogger(level: LogLevel = "silly"): CapturedLogger {
  const chunks: string[] = []
  const destination: DestinationStream = {
    write: (chunk: string) => {
      chunks.push(chunk)
    },
  }
  return {
    base: createPinoLogger({ level, destination }),
    lines: () => chunks.map((chunk) => JSON.parse(chunk) as Record<string, unknown>),
    raw: () => chunks.join(""),
  }
}
