/**
 * A picture's width and height read from its header alone (PNG's IHDR,
 * JPEG's SOF, WebP's VP8, VP8L or VP8X), never decoded: the gateway holds
 * a picture to a pixel limit before any service gets it. A small reader of
 * our own; the shop's (apps/backend lib/security/upload/image-header.ts)
 * is outside this app's TypeScript root. Null when the header is not one
 * of these, is cut short, or names an empty side.
 */

export interface PixelSize {
  width: number
  height: number
}

const u16be = (b: Buffer, at: number) => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0)
const u32be = (b: Buffer, at: number) => u16be(b, at) * 0x10000 + u16be(b, at + 2)
const u16le = (b: Buffer, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8)
const u24le = (b: Buffer, at: number) => u16le(b, at) + (b[at + 2] ?? 0) * 0x10000
const u32le = (b: Buffer, at: number) => u16le(b, at) + u16le(b, at + 2) * 0x10000
const ascii = (b: Buffer, at: number, length: number) =>
  at + length <= b.length ? b.toString("latin1", at, at + length) : ""

const sized = (width: number, height: number): PixelSize | null =>
  width > 0 && height > 0 ? { width, height } : null

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex")

function png(b: Buffer): PixelSize | null {
  const isPng = b.length >= 24 && b.subarray(0, 8).equals(PNG_SIGNATURE)
  return isPng && u32be(b, 8) === 13 && ascii(b, 12, 4) === "IHDR"
    ? sized(u32be(b, 16), u32be(b, 20))
    : null
}

// Start of frame markers: C0–CF but DHT (C4), JPG (C8) and DAC (CC)
const isStartOfFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

function jpeg(b: Buffer): PixelSize | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) {
    return null
  }
  let at = 2
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) {
      return null
    }
    const marker = b[at + 1] ?? 0
    if (marker === 0xff) {
      at += 1 // a fill byte
    } else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2 // a marker with no length
    } else if (marker === 0xd9 || marker === 0xda) {
      return null // the image ends or its data starts before any frame
    } else if (isStartOfFrame(marker)) {
      // Length, precision, then height and width
      return at + 9 <= b.length ? sized(u16be(b, at + 7), u16be(b, at + 5)) : null
    } else {
      const length = u16be(b, at + 2)
      if (length < 2) {
        return null
      }
      at += 2 + length
    }
  }
  return null
}

function webp(b: Buffer): PixelSize | null {
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") {
    return null
  }
  const chunk = ascii(b, 12, 4)
  if (
    chunk === "VP8 " &&
    b.length >= 30 &&
    b.subarray(23, 26).equals(Buffer.from([0x9d, 1, 0x2a]))
  ) {
    return sized(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff)
  }
  if (chunk === "VP8L" && b.length >= 25 && b[20] === 0x2f) {
    const bits = u32le(b, 21)
    return sized((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)
  }
  if (chunk === "VP8X" && b.length >= 30) {
    return sized(u24le(b, 24) + 1, u24le(b, 27) + 1)
  }
  return null
}

/** The picture's size from its header, by the type its first bytes showed; null if unread. */
export function pixelSizeOf(type: string, bytes: Buffer): PixelSize | null {
  switch (type) {
    case "image/png":
      return png(bytes)
    case "image/jpeg":
      return jpeg(bytes)
    case "image/webp":
      return webp(bytes)
    default:
      return null
  }
}
