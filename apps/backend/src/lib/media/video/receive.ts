import { createWriteStream } from "node:fs"
import { mkdtemp, open, rm } from "node:fs/promises"
import type { IncomingMessage } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import busboy from "busboy"
import { ValidationError } from "../../errors"
import { SIGNATURE_BYTES, VIDEO_MAX_BYTES, VIDEO_TITLE_MAX } from "./limits"

/**
 * A video upload's body, streamed to a private temporary file (adr/0069
 * §3): never held in memory. Busboy (multer's own parser) reads the
 * multipart body; the file's bytes are counted as they pass and the upload
 * is cut the moment it goes past 50 MB. One file part (`file`) and an
 * optional `title`; anything else refuses the upload. The caller makes the
 * directory (`makeVideoTempDir`, 0700) and removes it on every way out
 * (`removeVideoTempDir`); the file inside is written 0600.
 */

export interface ReceivedVideo {
  path: string
  bytes: number
  title: string | null
}

const SOURCE_NAME = "source"

/** A fresh private directory for one upload's file (mkdtemp makes it 0700). */
export const makeVideoTempDir = (root: string = tmpdir()): Promise<string> =>
  mkdtemp(join(root, "qt-video-"))

/** Removes an upload's directory and what is in it; never throws. */
export async function removeVideoTempDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true })
  } catch {
    // Already gone, or the next start's tmp cleaning takes it
  }
}

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

/**
 * Reads the request's multipart body into `<dir>/source`. Throws a
 * `ValidationError`: `video.too_large` past `maxBytes`, `video.file_required`
 * without a file part, `upload.too_many_files` for more parts than allowed,
 * `video.title_invalid`, `video.unreadable` for an empty file. A refused
 * body is drained (bounded by the path's declared-size gate) so the answer
 * reaches the client.
 */
export function receiveVideo(
  req: IncomingMessage,
  dir: string,
  maxBytes: number = VIDEO_MAX_BYTES
): Promise<ReceivedVideo> {
  const path = join(dir, SOURCE_NAME)
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
      // Not multipart, or no boundary
      reject(refuse("video.file_required"))
      return
    }
    let settled = false
    let bytes = 0
    let title: string | null = null
    let writing: Promise<void> | null = null
    let parsed = false
    const fail = (error: unknown) => {
      if (settled) {
        return
      }
      settled = true
      req.unpipe(parser)
      req.resume()
      reject(error instanceof Error ? error : new Error("video upload failed"))
    }
    const finish = () => {
      if (settled || !parsed) {
        return
      }
      if (!writing) {
        fail(refuse("video.file_required"))
        return
      }
      writing.then(
        () => {
          if (settled) {
            return
          }
          if (bytes === 0) {
            fail(refuse("video.unreadable"))
            return
          }
          settled = true
          resolve({ path, bytes, title })
        },
        (error: unknown) => {
          fail(error)
        }
      )
    }
    parser.on("file", (name, file) => {
      if (name !== "file" || writing) {
        file.resume()
        fail(refuse(name === "file" ? "upload.too_many_files" : "video.file_required"))
        return
      }
      const counter = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          bytes += chunk.length
          if (bytes > maxBytes) {
            done(refuse("video.too_large"))
            return
          }
          done(null, chunk)
        },
      })
      file.on("limit", () => {
        counter.destroy(refuse("video.too_large"))
      })
      writing = pipeline(file, counter, createWriteStream(path, { flags: "wx", mode: 0o600 }))
      writing.catch((error: unknown) => {
        file.resume()
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
    req.on("error", () => {
      fail(refuse("video.unreadable"))
    })
    req.pipe(parser)
  })
}

/** The first bytes of a received file, enough to tell what it is. */
export async function readHead(
  path: string,
  length: number = SIGNATURE_BYTES
): Promise<Uint8Array> {
  const handle = await open(path, "r")
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}
