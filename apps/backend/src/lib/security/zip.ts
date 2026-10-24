import type { Readable } from "node:stream"
import yauzl from "yauzl"
import type { Entry, ZipFile } from "yauzl"
import { ValidationError } from "../errors"

/**
 * Zip archives from outside (imports; xlsx is a zip too, F3.9; docs/04),
 * read within limits: entry count, real decompressed size per entry and in
 * total, and compression ratio (a zip bomb), with no path traversal and no
 * symbolic links. Sizes are counted as bytes come out, not taken from the
 * headers, which an archive can fake.
 */

export interface ZipLimits {
  maxEntries: number
  maxEntryBytes: number
  maxTotalBytes: number
  /** Decompressed over compressed size; text compresses about 10 times. */
  maxRatio: number
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxEntries: 1_000,
  maxEntryBytes: 50 * 1024 * 1024,
  maxTotalBytes: 100 * 1024 * 1024,
  maxRatio: 100,
}

export interface ZipEntryData {
  name: string
  data: Buffer
}

const fail = (code: string, cause?: unknown) =>
  new ValidationError(`zip.${code}`, cause === undefined ? {} : { cause })

// Unix file type bits live in the high 16 bits of the external attributes
const S_IFMT = 0o170000
const S_IFLNK = 0o120000
const isSymlink = (entry: Entry) => ((entry.externalFileAttributes >>> 16) & S_IFMT) === S_IFLNK

// yauzl refuses unsafe names itself (absolute paths, "..", backslashes)
const UNSAFE_NAME_ERRORS = /absolute path|invalid relative path|invalid characters in fileName/
// eslint-disable-next-line no-control-regex -- control characters are what it looks for
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

const open = (buffer: Buffer): Promise<ZipFile> =>
  new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (error, zipfile) => {
        if (error) {
          reject(error)
        } else {
          resolve(zipfile)
        }
      }
    )
  })

const openStream = (zipfile: ZipFile, entry: Entry): Promise<Readable> =>
  new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(error)
      } else {
        resolve(stream)
      }
    })
  })

/**
 * Two entries with one name (or names equal but for case or Unicode form)
 * would let this check and a later reader see different files: an xlsx with
 * two `xl/workbook.xml`. `seen` holds the names read so far.
 */
function checkEntry(entry: Entry, limits: ZipLimits, seen: Set<string>): void {
  const name = entry.fileName.normalize("NFC").toLowerCase()
  if (isSymlink(entry) || name === "" || CONTROL_CHARS.test(name) || seen.has(name)) {
    throw fail("unsafe_entry")
  }
  seen.add(name)
  if (entry.uncompressedSize > limits.maxEntryBytes) {
    throw fail("too_large")
  }
  const ratio = entry.uncompressedSize / Math.max(entry.compressedSize, 1)
  if (ratio > limits.maxRatio) {
    throw fail("ratio_too_high")
  }
}

async function readEntryData(
  zipfile: ZipFile,
  entry: Entry,
  limits: ZipLimits,
  used: { total: number }
): Promise<Buffer> {
  const stream = await openStream(zipfile, entry)
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of stream) {
    const buffer = chunk as Buffer
    size += buffer.length
    used.total += buffer.length
    if (size > limits.maxEntryBytes || used.total > limits.maxTotalBytes) {
      stream.destroy()
      throw fail("too_large")
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

function nextEntry(zipfile: ZipFile): Promise<Entry | null> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      zipfile.removeListener("entry", onEntry)
      zipfile.removeListener("end", onEnd)
      zipfile.removeListener("error", onError)
    }
    const onEntry = (entry: Entry) => {
      cleanup()
      resolve(entry)
    }
    const onEnd = () => {
      cleanup()
      resolve(null)
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    zipfile.on("entry", onEntry)
    zipfile.on("end", onEnd)
    zipfile.on("error", onError)
    zipfile.readEntry()
  })
}

/** The archive's files (directories skipped), or a `ValidationError` with a `zip.*` key. */
export async function readZipSafely(
  buffer: Buffer,
  limits: ZipLimits = DEFAULT_ZIP_LIMITS
): Promise<ZipEntryData[]> {
  let zipfile: ZipFile | undefined
  try {
    zipfile = await open(buffer)
    if (zipfile.entryCount > limits.maxEntries) {
      throw fail("too_many_entries")
    }
    const entries: ZipEntryData[] = []
    const used = { total: 0 }
    const seen = new Set<string>()
    for (let entry = await nextEntry(zipfile); entry; entry = await nextEntry(zipfile)) {
      checkEntry(entry, limits, seen)
      if (!entry.fileName.endsWith("/")) {
        entries.push({
          name: entry.fileName,
          data: await readEntryData(zipfile, entry, limits, used),
        })
      }
    }
    return entries
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error
    }
    const message = error instanceof Error ? error.message : ""
    throw fail(UNSAFE_NAME_ERRORS.test(message) ? "unsafe_entry" : "invalid", error)
  } finally {
    // No file handle with fromBuffer; kept for a later switch to yauzl.open
    zipfile?.close()
  }
}
