import { Worker } from "node:worker_threads"
import { RetryableError, ValidationError } from "../errors"
import { errorSummary, logger } from "../logging"
import type { CleanSvg } from "./svg-clean"

export type { CleanSvg } from "./svg-clean"
export { SVG_DEFAULT_SIDE } from "./svg-clean"
export {
  SVG_MAX_ALL_ATTRIBUTES,
  SVG_MAX_ATTRIBUTES,
  SVG_MAX_DEPTH,
  SVG_MAX_ELEMENTS,
  looksLikeSvg,
} from "./svg-scan"

/**
 * SVG for the shop's logos and site icon, cleaned off the event loop.
 * The cleaner (`svg-clean.ts`: jsdom, DOMPurify, an allow list) runs in a
 * worker thread, one per file, under a hard time limit and a memory limit,
 * at most two at a time: a file made to keep a parser or cleaner busy
 * costs only its own request, never the shop's other requests (a payment
 * callback among them). A file past the limits is refused as too complex.
 * No worker, no cleaning: one that cannot start fails the upload, it never
 * falls back to cleaning on the event loop.
 */

/** The largest SVG taken at all (a logo); the site icon's own limit is lower. */
export const SVG_MAX_BYTES = 200 * 1024
export const SVG_MIME = "image/svg+xml"

/** How long one cleaning may take once its worker is up; past it the worker is ended. */
export const SVG_CLEAN_TIMEOUT_MS = 3_000
// Loading jsdom and DOMPurify (and, from TypeScript sources, its compiler) before the clock
const START_TIMEOUT_MS = 30_000
const CONCURRENCY = 2
const RESOURCE_LIMITS = { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32 }

// The worker: plain CommonJS, so it needs no build step of its own. It loads the cleaner
// module the main thread resolved (the compiled `.js` once built; the `.ts` source under
// the tests and `medusa develop`, through ts-node, as Medusa itself runs it there)
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads")
if (workerData.register) {
  require(workerData.register).register({ transpileOnly: true, swc: true })
}
const { cleanSvg } = require(workerData.module)
parentPort.once("message", ({ bytes, maxBytes }) => {
  try {
    const clean = cleanSvg(Buffer.from(bytes), maxBytes)
    parentPort.postMessage({ ok: true, buffer: clean.buffer, width: clean.width, height: clean.height })
  } catch (error) {
    const code = error && typeof error.safeMessage === "string" ? error.safeMessage : null
    parentPort.postMessage({ ok: false, code, message: code ? null : String(error && error.message) })
  }
})
parentPort.postMessage({ ready: true })
`

interface Loaded {
  module: string
  register: string | null
}

let loaded: Loaded | undefined

/** Where the cleaner module is, and what loads TypeScript when it is the source. */
function cleanerModule(): Loaded {
  if (!loaded) {
    const module = require.resolve("./svg-clean")
    loaded = {
      module,
      register: module.endsWith(".ts") ? require.resolve("ts-node") : null,
    }
  }
  return loaded
}

type Answer =
  | { ok: true; buffer: Uint8Array; width: number; height: number }
  | { ok: false; code: string | null; message: string | null }

const tooComplex = () => new ValidationError("upload.svg_too_complex", { field: "files" })

/** One cleaning in its own worker; the worker is ended whatever the outcome. */
function runWorker(
  bytes: Uint8Array,
  maxBytes: number,
  timeoutMs: number,
  target: Loaded
): Promise<CleanSvg> {
  return new Promise<CleanSvg>((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: target,
      resourceLimits: RESOURCE_LIMITS,
    })
    let started = false
    let settled = false
    const finish = (outcome: () => void) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      outcome()
    }
    let timer = setTimeout(() => {
      finish(() => {
        reject(new Error("svg cleaner did not start"))
      })
    }, START_TIMEOUT_MS)
    worker.on("message", (message: { ready: true } | Answer) => {
      if ("ready" in message) {
        started = true
        clearTimeout(timer)
        timer = setTimeout(() => {
          logger.warn({ event: "media.svg_clean_timeout", timeoutMs })
          finish(() => {
            reject(tooComplex())
          })
        }, timeoutMs)
        worker.postMessage({ bytes, maxBytes })
        return
      }
      finish(() => {
        if (message.ok) {
          // What comes back is checked as any other input: within the limit, a real box
          const buffer = Buffer.from(message.buffer)
          const sides = [message.width, message.height]
          if (
            buffer.length === 0 ||
            buffer.length > maxBytes ||
            !sides.every((side) => Number.isFinite(side) && side > 0)
          ) {
            logger.warn({ event: "media.svg_clean_answer_invalid", bytes: buffer.length })
            reject(new ValidationError("upload.svg_invalid", { field: "files" }))
            return
          }
          resolve({ buffer, width: message.width, height: message.height })
        } else if (message.code) {
          reject(new ValidationError(message.code, { field: "files" }))
        } else {
          logger.warn({ event: "media.svg_clean_failed", err: message.message })
          reject(new ValidationError("upload.svg_invalid", { field: "files" }))
        }
      })
    })
    worker.on("error", (error: Error) => {
      // Out of memory or a crash while cleaning: the file's doing; before it started: ours
      logger.warn({ event: "media.svg_worker_error", started, err: errorSummary(error) })
      finish(() => {
        reject(started ? tooComplex() : error)
      })
    })
    worker.on("exit", (code) => {
      finish(() => {
        reject(started ? tooComplex() : new Error(`svg cleaner exited with ${String(code)}`))
      })
    })
  })
}

/** Cleanings waiting for a slot at most; past it the upload is refused as busy. */
export const SVG_MAX_WAITING = 8
/** How long a cleaning waits for a slot at most. */
export const SVG_WAIT_TIMEOUT_MS = 15_000

let running = 0
const waiting: { take: () => void; timer: NodeJS.Timeout }[] = []

const busy = () => new RetryableError("upload.svg_busy", { retryAfterMs: 5_000 })

/**
 * A slot among the two cleanings at once. A freed slot passes straight to
 * the first waiting (the count never drops in between, so no newcomer
 * slips past the queue); at most eight wait, none longer than 15 s.
 */
async function slot(): Promise<() => void> {
  const release = () => {
    const next = waiting.shift()
    if (next) {
      clearTimeout(next.timer)
      next.take()
    } else {
      running--
    }
  }
  if (running < CONCURRENCY) {
    running++
    return release
  }
  if (waiting.length >= SVG_MAX_WAITING) {
    throw busy()
  }
  await new Promise<void>((resolve, reject) => {
    const entry = {
      take: resolve,
      timer: setTimeout(() => {
        const index = waiting.indexOf(entry)
        if (index >= 0) {
          waiting.splice(index, 1)
        }
        reject(busy())
      }, SVG_WAIT_TIMEOUT_MS),
    }
    waiting.push(entry)
  })
  return release
}

/**
 * The SVG as it may be stored (cleaned, its box), or a `ValidationError`
 * (`upload.svg_*`; `upload.svg_too_complex` past the time or memory limit),
 * or a `RetryableError` (`upload.svg_busy`: too many waiting, or waiting
 * too long). A cleaner that cannot start throws a plain error: the upload
 * fails.
 */
export async function sanitizeSvg(
  bytes: Uint8Array,
  maxBytes = SVG_MAX_BYTES,
  options: {
    timeoutMs?: number
    /** Another cleaner module (tests: one that is not there must fail the upload). */
    module?: string
  } = {}
): Promise<CleanSvg> {
  if (bytes.length > maxBytes) {
    throw new ValidationError("upload.svg_too_large", { field: "files" })
  }
  const release = await slot()
  try {
    const target = options.module ? { module: options.module, register: null } : cleanerModule()
    return await runWorker(bytes, maxBytes, options.timeoutMs ?? SVG_CLEAN_TIMEOUT_MS, target)
  } finally {
    release()
  }
}
