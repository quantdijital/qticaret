/**
 * Image type and dimensions from the first bytes of a file (F2.9b): the
 * type comes from the content, never from the name or the declared MIME
 * type. Only JPEG, PNG, WebP and AVIF are recognised; anything else (SVG,
 * a script renamed .png) reads as null. A small reader of our own instead
 * of image-size, which parses dozens of formats we never accept.
 */

export type ImageType = "jpeg" | "png" | "webp" | "avif"

export interface ImageInfo {
  type: ImageType
  width: number
  height: number
}

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  start + length <= bytes.length
    ? String.fromCharCode(...bytes.subarray(start, start + length))
    : ""

const u16be = (b: Uint8Array, at: number) => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0)
const u16le = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8)
const u24le = (b: Uint8Array, at: number) => u16le(b, at) | ((b[at + 2] ?? 0) << 16)
const u32be = (b: Uint8Array, at: number) => u16be(b, at) * 0x10000 + u16be(b, at + 2)
const u32le = (b: Uint8Array, at: number) => u16le(b, at) + u16le(b, at + 2) * 0x10000

const sized = (type: ImageType, width: number, height: number): ImageInfo | null =>
  width > 0 && height > 0 ? { type, width, height } : null

// Signature, then the IHDR chunk: length 13, type, data and CRC
const PNG_HEADER_BYTES = 8 + 4 + 4 + 13 + 4

function readPng(b: Uint8Array): ImageInfo | null {
  const isPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => b[i] === byte)
  return isPng && b.length >= PNG_HEADER_BYTES && u32be(b, 8) === 13 && ascii(b, 12, 4) === "IHDR"
    ? sized("png", u32be(b, 16), u32be(b, 20))
    : null
}

// Start-of-frame markers carry the dimensions; C4, C8 and CC are not frames
const isStartOfFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

function readJpeg(b: Uint8Array): ImageInfo | null {
  if (b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) {
    return null
  }
  let at = 2
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) {
      return null
    }
    const marker = b[at + 1] ?? 0
    // Fill bytes and markers without a length
    if (marker === 0xff || (marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) {
      at += marker === 0xff ? 1 : 2
      continue
    }
    if (marker === 0xda || marker === 0xd9) {
      return null
    }
    if (isStartOfFrame(marker)) {
      return sized("jpeg", u16be(b, at + 7), u16be(b, at + 5))
    }
    const length = u16be(b, at + 2)
    if (length < 2) {
      return null
    }
    at += 2 + length
  }
  return null
}

// Bytes each first chunk needs for its dimensions
const WEBP_CHUNK_BYTES: Record<string, number> = { "VP8 ": 10, VP8L: 5, VP8X: 10 }

function readWebp(b: Uint8Array): ImageInfo | null {
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") {
    return null
  }
  // The sizes must hold: the file covers what RIFF declares, and the first
  // chunk holds its header. Otherwise a 16-byte text would read as an image.
  const chunk = ascii(b, 12, 4)
  const chunkSize = u32le(b, 16)
  const needed = WEBP_CHUNK_BYTES[chunk]
  if (
    needed === undefined ||
    u32le(b, 4) + 8 > b.length ||
    chunkSize < needed ||
    20 + chunkSize > b.length
  ) {
    return null
  }
  switch (chunk) {
    case "VP8 ":
      return b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a
        ? sized("webp", u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff)
        : null
    case "VP8L": {
      if (b[20] !== 0x2f) {
        return null
      }
      const [b0 = 0, b1 = 0, b2 = 0, b3 = 0] = b.subarray(21, 25)
      return sized(
        "webp",
        1 + (b0 | ((b1 & 0x3f) << 8)),
        1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10))
      )
    }
    case "VP8X":
      return sized("webp", 1 + u24le(b, 24), 1 + u24le(b, 27))
    default:
      return null
  }
}

interface Box {
  type: string
  start: number
  end: number
}

const MAX_BOXES = 64

/**
 * The ISO-BMFF boxes filling [start, end), or null when a size is malformed
 * or there are more than MAX_BOXES: a walk that stops early could miss the
 * box that matters (the real image size behind a decoy), so it fails closed.
 */
function boxes(b: Uint8Array, start: number, end: number): Box[] | null {
  const found: Box[] = []
  let at = start
  while (at < end) {
    if (found.length === MAX_BOXES || at + 8 > end) {
      return null
    }
    let size = u32be(b, at)
    let header = 8
    if (size === 1) {
      size = u32be(b, at + 12) + u32be(b, at + 8) * 0x100000000
      header = 16
    } else if (size === 0) {
      size = end - at
    }
    if (size < header || at + size > end) {
      return null
    }
    found.push({ type: ascii(b, at + 4, 4), start: at + header, end: at + size })
    at += size
  }
  return found
}

// A box's children, or null when they do not parse; `skip` passes a full
// box's version and flags
const children = (b: Uint8Array, parent: Box | undefined, skip = 0): Box[] | null =>
  parent ? boxes(b, parent.start + skip, parent.end) : null

const AVIF_BRANDS = new Set(["avif", "avis"])
// Real files list a handful of compatible brands
const MAX_BRANDS = 32

function hasAvifBrand(b: Uint8Array, ftyp: Box): boolean {
  if (AVIF_BRANDS.has(ascii(b, ftyp.start, 4))) {
    return true
  }
  const end = Math.min(ftyp.end, ftyp.start + 8 + MAX_BRANDS * 4)
  for (let at = ftyp.start + 8; at + 4 <= end; at += 4) {
    if (AVIF_BRANDS.has(ascii(b, at, 4))) {
      return true
    }
  }
  return false
}

const find = (list: Box[] | null, type: string) => list?.find((box) => box.type === type)

function readAvif(b: Uint8Array): ImageInfo | null {
  const top = boxes(b, 0, b.length)
  const ftyp = find(top, "ftyp")
  if (!ftyp || !hasAvifBrand(b, ftyp)) {
    return null
  }
  // meta is a full box: its children start after version and flags
  const properties = children(b, find(children(b, find(top, "meta"), 4), "iprp"))
  const ipco = children(b, find(properties, "ipco"))
  if (ipco === null) {
    return null
  }
  // Thumbnails and alpha planes have their own ispe; the largest counts
  let width = 0
  let height = 0
  for (const box of ipco) {
    if (box.type === "ispe") {
      if (box.end - box.start < 12) {
        return null
      }
      width = Math.max(width, u32be(b, box.start + 4))
      height = Math.max(height, u32be(b, box.start + 8))
    }
  }
  return sized("avif", width, height)
}

/** The image's type and size, or null for anything not an accepted image. */
export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  return readPng(bytes) ?? readJpeg(bytes) ?? readWebp(bytes) ?? readAvif(bytes)
}
