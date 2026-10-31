import { randomUUID } from "node:crypto"

/**
 * A logged error as an error tracking event (adr/0045). Built from the log
 * line as written, after the logger's redaction (lib/logging/redact.ts), so
 * GlitchTip receives nothing a log line would not hold. Only what names the
 * failure is kept: the event, the error's kind, message and frames, and the
 * request's method, path and status; the rest of the line stays in the logs.
 */

export interface LogLine {
  level?: unknown
  time?: unknown
  msg?: unknown
  event?: unknown
  request_id?: unknown
  method?: unknown
  path?: unknown
  status?: unknown
  err?: unknown
}

interface Frame {
  function?: string
  filename: string
  lineno?: number
  colno?: number
  in_app: boolean
}

export interface TrackedEvent {
  event_id: string
  timestamp: string
  platform: "node"
  level: "error" | "fatal"
  logger: string
  environment: string
  release?: string
  server_name?: string
  transaction?: string
  message?: { formatted: string }
  exception?: { values: { type: string; value: string; stacktrace?: { frames: Frame[] } }[] }
  tags: Record<string, string>
  fingerprint: string[]
}

export interface EventContext {
  environment: string
  release?: string
  serverName?: string
  /** Paths below it are reported relative to it, and count as the app's own. */
  root: string
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined

// V8's two frame forms: `at fn (file:line:col)` and `at file:line:col`
const FRAME = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/

/** Frames oldest first, as Sentry reads them; V8 writes the newest first. */
export function framesOf(stack: string, root: string): Frame[] {
  const frames: Frame[] = []
  for (const line of stack.split("\n")) {
    const match = FRAME.exec(line)
    if (!match) {
      continue
    }
    const [, fn, file = "", lineNo, colNo] = match
    const own = file.startsWith(root) && !file.includes("node_modules")
    frames.push({
      ...(fn ? { function: fn } : {}),
      filename: file.startsWith(root) ? file.slice(root.length).replace(/^\//, "") : file,
      lineno: Number(lineNo),
      colno: Number(colNo),
      in_app: own,
    })
  }
  return frames.reverse()
}

function exceptionOf(err: unknown, root: string): TrackedEvent["exception"] {
  if (err === null || typeof err !== "object") {
    return undefined
  }
  const fields = err as { name?: unknown; type?: unknown; message?: unknown; stack?: unknown }
  const type = text(fields.name) ?? text(fields.type) ?? "Error"
  const stack = text(fields.stack)
  const frames = stack ? framesOf(stack, root) : []
  return {
    values: [
      {
        type,
        value: text(fields.message) ?? "",
        ...(frames.length > 0 ? { stacktrace: { frames } } : {}),
      },
    ],
  }
}

/** An event for a logged line at error level or above; null for one below. */
export function eventOf(line: LogLine, context: EventContext): TrackedEvent | null {
  const level = line.level === "fatal" ? "fatal" : line.level === "error" ? "error" : null
  if (!level) {
    return null
  }
  const event = text(line.event) ?? text(line.msg) ?? "error"
  const exception = exceptionOf(line.err, context.root)
  const firstOwn = exception?.values[0]?.stacktrace?.frames
    .slice()
    .reverse()
    .find((frame) => frame.in_app)
  const tags: Record<string, string> = { event }
  for (const [name, value] of [
    ["request_id", line.request_id],
    ["method", line.method],
    ["status", line.status],
  ] as const) {
    if (typeof value === "string" || typeof value === "number") {
      tags[name] = String(value)
    }
  }
  const path = text(line.path)
  return {
    event_id: randomUUID().replaceAll("-", ""),
    timestamp: text(line.time) ?? new Date().toISOString(),
    platform: "node",
    level,
    logger: "qticaret",
    environment: context.environment,
    ...(context.release ? { release: context.release } : {}),
    ...(context.serverName ? { server_name: context.serverName } : {}),
    ...(path ? { transaction: `${text(line.method) ?? ""} ${path}`.trim() } : {}),
    ...(exception ? { exception } : { message: { formatted: event } }),
    tags,
    // One issue per failure and place, however its message varies
    fingerprint: [
      event,
      exception?.values[0]?.type ?? "",
      firstOwn ? `${firstOwn.filename}:${firstOwn.function ?? ""}` : "",
    ],
  }
}
