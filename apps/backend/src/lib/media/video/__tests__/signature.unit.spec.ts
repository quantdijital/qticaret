import { SIGNATURE_BYTES, videoSignature } from ".."

const bytes = (...parts: (string | number[] | Uint8Array)[]): Uint8Array =>
  Buffer.concat(
    parts.map((part) =>
      typeof part === "string" ? Buffer.from(part, "latin1") : Buffer.from(part)
    )
  )

const be32 = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

/** An `ftyp` box with a major brand and compatible brands, then the next box's start. */
const ftyp = (major: string, compatible: string[] = [], declared?: number) => {
  const size = 16 + compatible.length * 4
  return bytes(be32(declared ?? size), "ftyp", major, [0, 0, 2, 0], ...compatible, be32(8), "free")
}

/** An EBML header holding a DocType (and a version element before it). */
const ebml = (docType: string, sizeByte?: number) => {
  const version = [0x42, 0x86, 0x81, 0x01]
  const doc = [0x42, 0x82, 0x80 | docType.length, ...Buffer.from(docType, "latin1")]
  const body = [...version, ...doc]
  return bytes(
    [0x1a, 0x45, 0xdf, 0xa3, sizeByte ?? 0x80 | body.length],
    body,
    [0x18, 0x53, 0x80, 0x67]
  )
}

describe("a video file's kind, by its first bytes (adr/0069 §3)", () => {
  it.each([
    ["isom", [], "mp4"],
    ["mp42", ["isom", "avc1"], "mp4"],
    ["M4V ", [], "mp4"],
    // A brand outside the list is accepted when a listed one is compatible
    ["iso5", ["iso6", "mp41"], "mp4"],
    ["qt  ", [], "mov"],
    ["mp42", ["qt  "], "mov"],
  ])("reads an ftyp box with brand %s (%j) as %s", (major, compatible, format) => {
    expect(videoSignature(ftyp(major, compatible))).toEqual({ format, demuxer: "mov" })
  })

  it("refuses an ftyp box with no known brand, a broken size or a cut-off box", () => {
    expect(videoSignature(ftyp("heic", ["mif1"]))).toBeNull()
    expect(videoSignature(ftyp("3gp4", ["3gp4"]))).toBeNull()
    // Smaller than a box can be, past the bound, a 64-bit size marker, past the bytes read
    expect(videoSignature(ftyp("isom", [], 8))).toBeNull()
    expect(videoSignature(ftyp("isom", [], 1024))).toBeNull()
    expect(videoSignature(ftyp("isom", [], 1))).toBeNull()
    expect(videoSignature(ftyp("isom", ["mp42"]).subarray(0, 18))).toBeNull()
    // A file that only starts with the movie box (old QuickTime) is not taken
    expect(videoSignature(bytes(be32(16), "moov", be32(8), "free"))).toBeNull()
  })

  it("reads WebM by the EBML DocType, and refuses Matroska", () => {
    expect(videoSignature(ebml("webm"))).toEqual({ format: "webm", demuxer: "matroska" })
    expect(videoSignature(ebml("matroska"))).toBeNull()
    expect(videoSignature(ebml("webmx"))).toBeNull()
  })

  it("refuses an EBML header of unknown size, too long, or cut short", () => {
    // 0xff: a one-byte size of all ones means "unknown"
    expect(videoSignature(ebml("webm", 0xff))).toBeNull()
    expect(videoSignature(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x40, 0xff]))).toBeNull()
    expect(videoSignature(ebml("webm").subarray(0, 9))).toBeNull()
    // A size byte of zero has no length marker at all
    expect(videoSignature(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00]))).toBeNull()
  })

  it("walks a hostile EBML header forward and stops: no endless loop on empty elements", () => {
    // Elements of size zero (an ID and a zero size) up to the header's end
    const empty = Array.from({ length: 60 }, () => [0xec, 0x80]).flat()
    const head = bytes([0x1a, 0x45, 0xdf, 0xa3, 0x80 | 0x78], empty)
    // An endless loop never returns at all; the clock only fences a walk gone
    // slow, with seconds of slack for a loaded CI runner (a forward walk of
    // these 120 bytes takes microseconds; adr/0081)
    const started = Date.now()
    expect(videoSignature(head)).toBeNull()
    expect(Date.now() - started).toBeLessThan(2_000)
    // An element claiming more than the header holds
    expect(videoSignature(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x82, 0x88, 0x77]))).toBeNull()
  })

  it("does not read GIF as a video (never uploaded, adr/0069 Kararlar 11)", () => {
    expect(videoSignature(bytes("GIF89a", [1, 0, 1, 0]))).toBeNull()
    expect(videoSignature(bytes("GIF87a", [1, 0, 1, 0]))).toBeNull()
  })

  it.each([
    [
      "an HLS playlist named .mp4",
      "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:10.0,\nconcat:/etc/passwd|subfile,,start,0,end,0,,:/etc/hosts\n#EXT-X-ENDLIST\n",
    ],
    ["a concat: path", "concat:/etc/passwd|/etc/hosts"],
    ["a subfile path", "subfile,,start,0,end,1024,,:/etc/passwd"],
    ["a data: URL", "data:video/mp4;base64,AAAAIGZ0eXBpc29t"],
    ["a DASH manifest", '<?xml version="1.0"?><MPD xmlns="urn:mpeg:dash:schema:mpd:2011">'],
    ["an AVI", bytes("RIFF", be32(1000), "AVI LIST")],
    ["an FLV", bytes("FLV", [1, 5, 0, 0, 0, 9])],
    ["an MPEG-TS packet", bytes([0x47, 0x40, 0x00, 0x10], new Array<number>(184).fill(0xff))],
    ["a PNG", bytes([0x89], "PNG\r\n\u001a\n")],
    ["an empty file", bytes()],
  ])("refuses %s", (_, content) => {
    expect(videoSignature(typeof content === "string" ? bytes(content) : content)).toBeNull()
  })

  it("finds an ftyp box only at the very start: a polyglot hiding it later is refused", () => {
    const hidden = bytes("#EXTM3U\n", ftyp("isom", ["mp42"]))
    expect(videoSignature(hidden)).toBeNull()
  })

  it("reads within the bytes it is given, however many", () => {
    const big = new Uint8Array(SIGNATURE_BYTES * 4).fill(0x1a)
    expect(videoSignature(big)).toBeNull()
  })
})
