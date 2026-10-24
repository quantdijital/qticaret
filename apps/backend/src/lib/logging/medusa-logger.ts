import { randomUUID } from "node:crypto"
import type { Logger } from "@medusajs/framework/types"
import { isLogLevel } from "./levels"
import type { LogLevel } from "./levels"
import { toPinoLevel } from "./logger"
import type { BaseLogger } from "./logger"

/**
 * Medusa's `Logger` interface on top of the platform logger, registered
 * through `defineConfig({ logger })`. Medusa resolves it from the container
 * for core code, modules and `medusa exec` scripts, so their lines get the
 * same JSON shape and redaction as ours.
 *
 * Activities (Medusa's spinners in development) are plain info lines here,
 * as Medusa itself writes them outside development.
 */
export class MedusaPinoLogger implements Logger {
  readonly #base: BaseLogger
  readonly #defaultLevel: LogLevel
  readonly #activityStarts = new Map<string, number>()

  /** Sets the shared logger to `defaultLevel`; `unsetLogLevel` returns to it. */
  constructor(base: BaseLogger, defaultLevel: LogLevel) {
    this.#base = base
    this.#defaultLevel = defaultLevel
    base.level = toPinoLevel(defaultLevel)
  }

  shouldLog(level: string): boolean {
    return isLogLevel(level) && this.#base.isLevelEnabled(toPinoLevel(level))
  }

  /** An unknown level name keeps the current level, as Medusa's logger does. */
  setLogLevel(level: string): void {
    if (isLogLevel(level)) {
      this.#base.level = toPinoLevel(level)
    }
  }

  unsetLogLevel(): void {
    this.#base.level = toPinoLevel(this.#defaultLevel)
  }

  /** Medusa calls this for unrecoverable startup errors and exits, as its own logger does. */
  panic(data: unknown): void {
    this.#base.fatal({ event: "medusa.panic", details: data }, "Medusa panic")
    process.exit(1)
  }

  activity(message: string, config?: unknown): string {
    const activityId = randomUUID()
    this.#activityStarts.set(activityId, Date.now())
    this.#base.info(
      { activity_id: activityId, ...(config === undefined ? {} : { config }) },
      message
    )
    return activityId
  }

  progress(activityId: string, message: string): void {
    this.#base.info({ activity_id: activityId }, message)
  }

  success(activityId: string, message: string): Record<string, unknown> {
    const result = this.#finish(activityId)
    this.#base.info({ activity_id: activityId, ...result }, message)
    return result
  }

  failure(activityId: string, message: string): unknown {
    const result = this.#finish(activityId)
    this.#base.error({ activity_id: activityId, ...result }, message)
    return result
  }

  error(messageOrError: string | Error, error?: Error): void {
    if (typeof messageOrError === "string") {
      this.#base.error(error === undefined ? {} : { err: error }, messageOrError)
      return
    }
    // Typed as Error, but workflow errors arrive as plain objects
    const message: unknown = (messageOrError as { message?: unknown } | null)?.message
    this.#base.error({ err: messageOrError }, typeof message === "string" ? message : "error")
  }

  silly(message: string): void {
    this.#base.trace(message)
  }

  debug(message: string): void {
    this.#base.debug(message)
  }

  verbose(message: string): void {
    this.#base.verbose(message)
  }

  http(message: string): void {
    this.#base.http(message)
  }

  info(message: string): void {
    this.#base.info(message)
  }

  warn(message: string): void {
    this.#base.warn(message)
  }

  /** winston's `log(level, message, ...meta)`, `log({ level, message })` or `log(message)`. */
  log(...args: unknown[]): void {
    const [first, second, ...meta] = args
    if (isLogLevel(first) && args.length > 1) {
      this.#write(first, second, meta)
      return
    }
    if (typeof first === "object" && first !== null && args.length === 1) {
      const { level, message, ...rest } = first as Record<string, unknown>
      this.#write(
        isLogLevel(level) ? level : "info",
        message,
        Object.keys(rest).length > 0 ? [rest] : []
      )
      return
    }
    this.#write("info", first, [])
  }

  #write(level: LogLevel, message: unknown, meta: unknown[]): void {
    const text = typeof message === "string" ? message : String(message)
    this.#base[toPinoLevel(level)](meta.length === 0 ? {} : { meta }, text)
  }

  #finish(activityId: string): Record<string, unknown> {
    const start = this.#activityStarts.get(activityId)
    this.#activityStarts.delete(activityId)
    return start === undefined ? {} : { duration: Date.now() - start }
  }
}
