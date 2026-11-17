/**
 * What a video file is, read from its first bytes (adr/0069 §3): the name
 * and the MIME type it came with are never asked. Only MP4/MOV (an `ftyp`
 * box with a known brand) and WebM (an EBML header whose DocType is
 * `webm`) are recognised; GIF (never uploaded, owner 2026-11-17),
 * Matroska, AVI, FLV, MPEG-TS, HLS/DASH playlists and everything else
 * read as null.
 *
 * Untrusted bytes: every loop here walks forward by at least one byte a
 * turn within a bound fixed up front, and no regular expression is used.
 */

export type VideoSourceFormat = "mp4" | "mov" | "webm"

/** The demuxer ffprobe and ffmpeg are forced to use (`-f`): never guessed from content. */
export type VideoDemuxer = "mov" | "matroska"

export interface VideoSignature {
  format: VideoSourceFormat
  demuxer: VideoDemuxer
}

// adr/0069 §3: the brands of phones, cameras and editors' MP4 and MOV files
const MP4_BRANDS: ReadonlySet<string> = new Set(["isom", "iso2", "mp41", "mp42", "avc1", "M4V "])
const QUICKTIME_BRAND = "qt  "
// An `ftyp` box is small: a major brand, a version and a few compatible brands
const FTYP_MIN = 16
const FTYP_MAX = 256

const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3]
const EBML_DOCTYPE_ID = 0x4282
// The EBML header holds a handful of short elements
const EBML_HEADER_MAX = 256

const ascii = (bytes: Uint8Array, start: number, length: number): string => {
  let text = ""
  for (let index = start; index < start + length; index++) {
    text += String.fromCharCode(bytes[index] ?? 0)
  }
  return text
}

const uint32 = (bytes: Uint8Array, at: number): number =>
  (((bytes[at] ?? 0) << 24) >>> 0) +
  ((bytes[at + 1] ?? 0) << 16) +
  ((bytes[at + 2] ?? 0) << 8) +
  (bytes[at + 3] ?? 0)

function isoMedia(bytes: Uint8Array): VideoSignature | null {
  if (bytes.length < FTYP_MIN || ascii(bytes, 4, 4) !== "ftyp") {
    return null
  }
  const size = uint32(bytes, 0)
  if (size < FTYP_MIN || size > FTYP_MAX || size > bytes.length) {
    return null
  }
  const major = ascii(bytes, 8, 4)
  if (major === QUICKTIME_BRAND) {
    return { format: "mov", demuxer: "mov" }
  }
  let known = MP4_BRANDS.has(major)
  let quicktime = false
  // Compatible brands: four bytes each after the minor version, up to the box's end
  for (let at = 16; at + 4 <= size; at += 4) {
    const brand = ascii(bytes, at, 4)
    known ||= MP4_BRANDS.has(brand)
    quicktime ||= brand === QUICKTIME_BRAND
  }
  if (quicktime) {
    return { format: "mov", demuxer: "mov" }
  }
  return known ? { format: "mp4", demuxer: "mov" } : null
}

interface Vint {
  value: number
  length: number
}

/**
 * An EBML variable-length integer at `at`: its length is told by the first
 * byte's leading zeros. `keepMarker` keeps the length bit (element IDs);
 * a size of all ones ("unknown") reads as null, as does one past 8 bytes.
 */
function vint(bytes: Uint8Array, at: number, maxLength: number, keepMarker: boolean): Vint | null {
  const first = bytes[at]
  if (first === undefined || first === 0) {
    return null
  }
  let length = 1
  let mask = 0x80
  while ((first & mask) === 0) {
    length += 1
    mask >>= 1
  }
  if (length > maxLength || at + length > bytes.length) {
    return null
  }
  let value = keepMarker ? first : first & (mask - 1)
  let allOnes = (first & (mask - 1)) === mask - 1
  for (let index = 1; index < length; index++) {
    const byte = bytes[at + index] ?? 0
    value = value * 256 + byte
    allOnes &&= byte === 0xff
  }
  if (!keepMarker && allOnes) {
    return null
  }
  return { value, length }
}

function webm(bytes: Uint8Array): VideoSignature | null {
  if (bytes.length < 5 || EBML_MAGIC.some((byte, index) => bytes[index] !== byte)) {
    return null
  }
  const size = vint(bytes, 4, 8, false)
  if (!size || size.value > EBML_HEADER_MAX) {
    return null
  }
  const start = 4 + size.length
  const end = start + size.value
  if (end > bytes.length) {
    return null
  }
  let at = start
  // Each turn moves past an element's ID, size and data: at least two bytes
  while (at < end) {
    const id = vint(bytes, at, 4, true)
    if (!id) {
      return null
    }
    const length = vint(bytes, at + id.length, 8, false)
    if (!length) {
      return null
    }
    const data = at + id.length + length.length
    if (data + length.value > end) {
      return null
    }
    if (id.value === EBML_DOCTYPE_ID) {
      return ascii(bytes, data, length.value) === "webm"
        ? { format: "webm", demuxer: "matroska" }
        : null
    }
    at = data + length.value
  }
  return null
}

/** The file's kind by its first bytes (`SIGNATURE_BYTES` of them are enough), or null. */
export function videoSignature(bytes: Uint8Array): VideoSignature | null {
  return isoMedia(bytes) ?? webm(bytes)
}
