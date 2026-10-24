import { crc32, deflateRawSync } from "node:zlib"

/** A real 1×1 PNG. */
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
)

/** A PNG header claiming `width` × `height` (only the header is read). */
export function pngHeader(width: number, height: number): Buffer {
  const png = Buffer.from(PNG_1X1)
  png.writeUInt32BE(width, 16)
  png.writeUInt32BE(height, 20)
  return png
}

/** JPEG markers up to a baseline start-of-frame with the given size. */
export function jpegHeader(width: number, height: number): Buffer {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...Buffer.from("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]
  const sof = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    3,
  ]
  return Buffer.from([0xff, 0xd8, ...app0, ...sof, ...new Array<number>(9).fill(0)])
}

const riff = (chunk: string, payload: Buffer) => {
  const header = Buffer.alloc(20)
  header.write("RIFF", 0)
  header.writeUInt32LE(payload.length + 12, 4)
  header.write("WEBP", 8)
  header.write(chunk, 12)
  header.writeUInt32LE(payload.length, 16)
  return Buffer.concat([header, payload])
}

export function webpVp8x(width: number, height: number): Buffer {
  const payload = Buffer.alloc(10)
  payload.writeUIntLE(width - 1, 4, 3)
  payload.writeUIntLE(height - 1, 7, 3)
  return riff("VP8X", payload)
}

export function webpVp8l(width: number, height: number): Buffer {
  const w = width - 1
  const h = height - 1
  const bits = Buffer.from([
    0x2f,
    w & 0xff,
    ((w >> 8) & 0x3f) | ((h & 0x03) << 6),
    (h >> 2) & 0xff,
    (h >> 10) & 0x0f,
  ])
  return riff("VP8L", bits)
}

export function webpVp8(width: number, height: number): Buffer {
  const payload = Buffer.alloc(10)
  payload.set([0x9d, 0x01, 0x2a], 3)
  payload.writeUInt16LE(width, 6)
  payload.writeUInt16LE(height, 8)
  return riff("VP8 ", payload)
}

const box = (type: string, ...children: Buffer[]) => {
  const body = Buffer.concat(children)
  const header = Buffer.alloc(8)
  header.writeUInt32BE(body.length + 8, 0)
  header.write(type, 4)
  return Buffer.concat([header, body])
}

/** An AVIF with an `ispe` property per size (the image, then e.g. a thumbnail). */
export function avifHeader(...sizes: [number, number][]): Buffer {
  const ispe = sizes.map(([width, height]) => {
    const body = Buffer.alloc(12)
    body.writeUInt32BE(width, 4)
    body.writeUInt32BE(height, 8)
    return box("ispe", body)
  })
  const ftyp = box("ftyp", Buffer.from("avif"), Buffer.alloc(4), Buffer.from("mif1avif"))
  const meta = box(
    "meta",
    Buffer.alloc(4),
    box("hdlr", Buffer.alloc(24)),
    box("iprp", box("ipco", ...ispe))
  )
  return Buffer.concat([ftyp, meta])
}

export interface ZipFixtureEntry {
  name: string
  data: Buffer
  deflate?: boolean
  /** Unix mode in the external attributes (0o120777 marks a symlink). */
  mode?: number
  /** A false uncompressed size in the headers. */
  declaredSize?: number
}

/** A minimal zip writer for tests, able to build malformed and hostile archives. */
export function buildZip(entries: ZipFixtureEntry[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8")
    const body = entry.deflate ? deflateRawSync(entry.data) : entry.data
    const size = entry.declaredSize ?? entry.data.length
    const method = entry.deflate ? 8 : 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(crc32(entry.data), 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(size, 22)
    local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE((3 << 8) | 20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(crc32(entry.data), 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(size, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(((entry.mode ?? 0o100644) << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    locals.push(local, name, body)
    centrals.push(central, name)
    offset += local.length + name.length + body.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}
