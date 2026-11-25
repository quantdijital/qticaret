import { brotliDecompressSync } from "node:zlib"

/**
 * The characters a woff2 file maps (its `cmap`), read without a font
 * library: the tables are one brotli stream, `cmap` is never transformed,
 * and its format 4 or 12 subtable lists the ranges. For the specs only.
 */

/** The 63 known tags a table directory entry names by index (WOFF2 §5.1), four letters each. */
const TAG_LIST =
  "cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp " +
  "hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL " +
  "SVG  sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx " +
  "opbd prop trak Zapf Silf Glat Gloc Feat Sill"
const KNOWN_TAGS = Array.from({ length: 63 }, (_, i) => TAG_LIST.slice(i * 5, i * 5 + 4))

function base128(buf: Buffer, at: number): [number, number] {
  let value = 0
  for (let i = 0; i < 5; i++) {
    const byte = buf.readUInt8(at + i)
    value = value * 128 + (byte & 0x7f)
    if ((byte & 0x80) === 0) return [value, at + i + 1]
  }
  throw new Error("bad UIntBase128")
}

/** Each table's tag and its bytes in the decompressed stream. */
function tables(file: Buffer): Map<string, Buffer> {
  if (file.toString("latin1", 0, 4) !== "wOF2") throw new Error("not a woff2 file")
  const numTables = file.readUInt16BE(12)
  const compressed = file.readUInt32BE(20)
  let at = 48
  const entries: { tag: string; length: number }[] = []
  for (let i = 0; i < numTables; i++) {
    const flags = file.readUInt8(at++)
    const index = flags & 0x3f
    let tag = KNOWN_TAGS[index] ?? ""
    if (index === 0x3f) {
      tag = file.toString("latin1", at, at + 4)
      at += 4
    }
    let origLength: number
    ;[origLength, at] = base128(file, at)
    const version = (flags >> 6) & 3
    // glyf and loca are transformed at version 0, every other table at 1-3
    const transformed = tag === "glyf" || tag === "loca" ? version === 0 : version !== 0
    let length = origLength
    if (transformed) [length, at] = base128(file, at)
    entries.push({ tag, length })
  }
  const stream = brotliDecompressSync(file.subarray(at, at + compressed))
  const out = new Map<string, Buffer>()
  let offset = 0
  for (const { tag, length } of entries) {
    out.set(tag, stream.subarray(offset, offset + length))
    offset += length
  }
  return out
}

/** The code points a woff2 file has a glyph for. */
export function woff2CodePoints(file: Buffer): Set<number> {
  const cmap = tables(file).get("cmap")
  if (!cmap) throw new Error("no cmap table")
  const points = new Set<number>()
  const count = cmap.readUInt16BE(2)
  for (let i = 0; i < count; i++) {
    const sub = cmap.readUInt32BE(4 + i * 8 + 4)
    const format = cmap.readUInt16BE(sub)
    if (format === 4) {
      const segments = cmap.readUInt16BE(sub + 6) / 2
      const ends = sub + 14
      const starts = ends + segments * 2 + 2
      const deltas = starts + segments * 2
      const rangeOffsets = deltas + segments * 2
      for (let s = 0; s < segments; s++) {
        const end = cmap.readUInt16BE(ends + s * 2)
        const start = cmap.readUInt16BE(starts + s * 2)
        const delta = cmap.readUInt16BE(deltas + s * 2)
        const rangeOffset = cmap.readUInt16BE(rangeOffsets + s * 2)
        for (let c = start; c <= end && c !== 0xffff; c++) {
          const glyph =
            rangeOffset === 0
              ? (c + delta) & 0xffff
              : cmap.readUInt16BE(rangeOffsets + s * 2 + rangeOffset + (c - start) * 2)
          if (glyph !== 0) points.add(c)
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(sub + 12)
      for (let g = 0; g < groups; g++) {
        const start = cmap.readUInt32BE(sub + 16 + g * 12)
        const end = cmap.readUInt32BE(sub + 20 + g * 12)
        for (let c = start; c <= end; c++) points.add(c)
      }
    }
  }
  return points
}
