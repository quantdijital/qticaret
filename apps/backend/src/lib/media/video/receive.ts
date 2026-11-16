import { createWriteStream } from "node:fs"
import type { WriteStream } from "node:fs"
import type { IncomingMessage } from "node:http"
import { join } from "node:path"
import { Transform } from "node:stream"
import type { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import busboy from "busboy"
import { ValidationError } from "../../errors"
import { logger } from "../../logging"
import { VIDEO_MAX_BYTES, VIDEO_TITLE_MAX } from "./limits"

/**
 * A video upload's body, streamed to a private temporary file (adr/0069
 * §3): never held in memory. Busboy (multer's own parser) reads the
 * multipart body; the file's bytes are counted as they pass and the upload
 * is cut the moment it goes past 50 MB. One file part (`file`) and an
 * optional `title`; anything else refuses the upload. The caller makes the
 * directory (`makeVideoTempDir`, 0700) and removes it on every way out;
 * the file inside is written 0600.
 *
 * Every way out (security review Y1, O2) tears the whole chain down: the
 * parser, the file part, the counter and the file are destroyed, and the
 * answer waits until the file's descriptor is closed, so the directory's
 * removal frees the disk. A client that goes away (`close` before the body
 * is complete), stays silent past `idleMs` or takes longer than `totalMs`
 * ends it too; a timed-out request's socket is destroyed.
 */

export interface ReceivedVideo {
  path: string
  bytes: number
  title: string | null
}

export interface ReceiveTimeouts {
  /** Silence allowed between two pieces of the body. */
  idleMs: number
  /** The whole body at most. */
  totalMs: number
}

export const RECEIVE_TIMEOUTS: ReceiveTimeouts = { idleMs: 30_000, totalMs: 120_000 }

const SOURCE_NAME = "source"

const refuse = (code: string) => new ValidationError(code, { field: "file" })

// C0 and C1 controls, and the line and paragraph separators, are not a title's
function cleanTitle(value: string): string | null {
  const title = value.trim()
  if (title.length > VIDEO_TITLE_MAX) {
    throw new ValidationError("video.title_invalid", { field: "title" })
  }
  for (const char of title) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x20 || (code >= 0x7f && code < 0xa0) || code === 0x2028 || code === 0x2029) {
      throw new ValidationError("video.title_invalid", { field: "title" })
    }
  }
  return title === "" ? null : title
}

/** How long a file may take to close before the upload is given up on anyway (review B-2). */
export const CLOSE_WAIT_MS = 5_000

/**
 * Whether `writer`'s descriptor closed (at once when there is none) within
 * `waitMs`. A file that does not is logged; the caller refuses the upload
 * either way, and never waits on it for ever.
 */
export function fileClosed(
  writer: { closed: boolean; once: (event: "close", listener: () => void) => unknown } | null,
  waitMs = CLOSE_WAIT_MS
): Promise<boolean> {
  if (!writer || writer.closed) {
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      logger.warn({ event: "media.video_file_not_closed", wait_ms: waitMs })
      resolve(false)
    }, waitMs)
    timer.unref()
    writer.once("close", () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

/**
 * Reads the request's multipart body into `<dir>/source`. Throws a
 * `ValidationError`: `video.too_large` past `maxBytes`, `video.file_required`
 * without a file part (or a body that is not multipart), `upload.too_many_files`
 * for more parts than allowed, `video.title_invalid`, `video.unreadable` for
 * an empty, broken or abandoned body, `video.upload_timeout`.
 */
export function receiveVideo(
  req: IncomingMessage,
  dir: string,
  maxBytes: number = VIDEO_MAX_BYTES,
  timeouts: ReceiveTimeouts = RECEIVE_TIMEOUTS
): Promise<ReceivedVideo> {
  const path = join(dir, SOURCE_NAME)
  if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("multipart/form-data")) {
    return Promise.reject(refuse("video.file_required"))
  }
  return new Promise((resolve, reject) => {
    let parser: busboy.Busboy
    try {
      parser = busboy({
        headers: req.headers,
        defParamCharset: "utf8",
        limits: {
          files: 1,
          // One past ours: the counter below cuts first, busboy is the backstop
          fileSize: maxBytes + 1,
          fields: 1,
          fieldSize: VIDEO_TITLE_MAX * 4,
          // busboy stops at the limit's count itself: a title and a file are two
          parts: 3,
          headerPairs: 16,
        },
      })
    } catch {
      // No boundary
      reject(refuse("video.file_required"))
      return
    }
    const abort = new AbortController()
    let file: Readable | null = null
    let counter: Transform | null = null
    let writer: WriteStream | null = null
    let writing: Promise<void> | null = null
    let settled = false
    let parsed = false
    let bytes = 0
    let title: string | null = null
    const timers: { idle?: NodeJS.Timeout; total?: NodeJS.Timeout } = {}

    const stopListening = () => {
      clearTimeout(timers.idle)
      clearTimeout(timers.total)
      req.off("data", onData)
      req.off("close", onClose)
      req.off("error", onError)
    }
    /** Tears everything down; the answer waits for the file's descriptor to close. */
    const fail = (error: unknown, destroyRequest = false) => {
      if (settled) {
        return
      }
      settled = true
      stopListening()
      abort.abort()
      req.unpipe(parser)
      parser.destroy()
      file?.destroy()
      counter?.destroy()
      writer?.destroy()
      if (destroyRequest) {
        req.destroy()
      } else {
        // Drained (bounded by the path's gate) so the answer reaches the client
        req.resume()
      }
      void fileClosed(writer).then(() => {
        reject(error instanceof Error ? error : new Error("video upload failed"))
      })
    }
    const timedOut = () => {
      fail(refuse("video.upload_timeout"), true)
    }
    const onData = () => {
      clearTimeout(timers.idle)
      timers.idle = setTimeout(timedOut, timeouts.idleMs)
    }
    // The client went away before its body was complete
    const onClose = () => {
      if (!req.complete) {
        fail(refuse("video.unreadable"))
      }
    }
    const onError = () => {
      fail(refuse("video.unreadable"))
    }
    timers.total = setTimeout(timedOut, timeouts.totalMs)
    timers.idle = setTimeout(timedOut, timeouts.idleMs)

    const finish = () => {
      if (settled || !parsed) {
        return
      }
      if (!writing) {
        fail(refuse("video.file_required"))
        return
      }
      writing.then(
        async () => {
          const done = await fileClosed(writer)
          if (settled) {
            return
          }
          if (!done) {
            fail(refuse("video.unreadable"))
            return
          }
          if (bytes === 0) {
            fail(refuse("video.unreadable"))
            return
          }
          settled = true
          stopListening()
          resolve({ path, bytes, title })
        },
        (error: unknown) => {
          fail(error)
        }
      )
    }

    parser.on("file", (name, part) => {
      if (name !== "file" || writing) {
        part.resume()
        fail(refuse(name === "file" ? "upload.too_many_files" : "video.file_required"))
        return
      }
      file = part
      counter = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          bytes += chunk.length
          if (bytes > maxBytes) {
            done(refuse("video.too_large"))
            return
          }
          done(null, chunk)
        },
      })
      part.on("limit", () => {
        counter?.destroy(refuse("video.too_large"))
      })
      writer = createWriteStream(path, { flags: "wx", mode: 0o600 })
      writing = pipeline(part, counter, writer, { signal: abort.signal })
      writing.catch((error: unknown) => {
        fail(error)
      })
    })
    parser.on("field", (name, value, info) => {
      if (name !== "title" || info.valueTruncated || info.nameTruncated) {
        fail(
          name === "title"
            ? new ValidationError("video.title_invalid")
            : refuse("video.file_required")
        )
        return
      }
      try {
        title = cleanTitle(value)
      } catch (error) {
        fail(error)
      }
    })
    for (const limit of ["filesLimit", "fieldsLimit", "partsLimit"] as const) {
      parser.on(limit, () => {
        fail(refuse("upload.too_many_files"))
      })
    }
    parser.on("error", () => {
      // A broken or cut-off body: busboy's words are not passed on
      fail(refuse("video.unreadable"))
    })
    parser.on("close", () => {
      parsed = true
      finish()
    })
    req.on("data", onData)
    req.on("close", onClose)
    req.on("error", onError)
    req.pipe(parser)
  })
}
