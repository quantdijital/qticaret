/**
 * Picture headers of a given size, written by hand (the control plane has
 * no image library): just the bytes image-dimensions.ts reads, then a few
 * more. Tests only.
 */

const be16 = (value: number) => Buffer.from([(value >> 8) & 0xff, value & 0xff])
const be32 = (value: number) => {
  const bytes = Buffer.alloc(4)
  bytes.writeUInt32BE(value)
  return bytes
}
const le16 = (value: number) => Buffer.from([value & 0xff, (value >> 8) & 0xff])
const le24 = (value: number) =>
  Buffer.from([value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff])
const le32 = (value: number) => {
  const bytes = Buffer.alloc(4)
  bytes.writeUInt32LE(value >>> 0)
  return bytes
}

export function pngHeader(width: number, height: number): Buffer {
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    be32(13),
    Buffer.from("IHDR"),
    be32(width),
    be32(height),
    Buffer.from([8, 6, 0, 0, 0]),
    be32(0),
  ])
}

/** A JPEG with an APP0 (JFIF) segment before its frame; `sof` the frame's marker (C0, C2…). */
export function jpegHeader(width: number, height: number, sof = 0xc0): Buffer {
  const app0 = Buffer.concat([
    Buffer.from([0xff, 0xe0]),
    be16(16),
    Buffer.from("JFIF\0"),
    Buffer.from([1, 1, 0, 0, 1, 0, 1, 0, 0]),
  ])
  const frame = Buffer.concat([
    Buffer.from([0xff, sof]),
    be16(17),
    Buffer.from([8]),
    be16(height),
    be16(width),
    Buffer.from([3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]),
  ])
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, frame])
}

const riff = (chunk: string, data: Buffer) =>
  Buffer.concat([
    Buffer.from("RIFF"),
    le32(4 + 8 + data.length),
    Buffer.from("WEBP"),
    Buffer.from(chunk),
    le32(data.length),
    data,
  ])

/** A lossy WebP (`VP8 `): frame tag, start code, 14-bit sides. */
export const webpLossyHeader = (width: number, height: number): Buffer =>
  riff(
    "VP8 ",
    Buffer.concat([Buffer.from([0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a]), le16(width), le16(height)])
  )

/** A lossless WebP (`VP8L`): signature, then 14 bits each of width − 1 and height − 1. */
export const webpLosslessHeader = (width: number, height: number): Buffer =>
  riff(
    "VP8L",
    Buffer.concat([
      Buffer.from([0x2f]),
      le32(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14)),
    ])
  )

/** An extended WebP (`VP8X`): flags, reserved, then 24 bits each of width − 1 and height − 1. */
export const webpExtendedHeader = (width: number, height: number): Buffer =>
  riff("VP8X", Buffer.concat([Buffer.from([0x10, 0, 0, 0]), le24(width - 1), le24(height - 1)]))
