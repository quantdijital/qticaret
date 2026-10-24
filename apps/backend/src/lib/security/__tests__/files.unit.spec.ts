import { escapeCsvCell, toCsv } from "../csv"
import { readImageInfo } from "../upload/image-header"
import { storedName, validateUpload } from "../upload/validate-upload"
import { parseXmlSafely } from "../xml"
import { PNG_1X1, avifHeader, jpegHeader, pngHeader, webpVp8, webpVp8l, webpVp8x } from "./fixtures"

const reasonOf = (run: () => unknown): unknown => {
  try {
    run()
  } catch (error) {
    return (error as { safeMessage?: unknown }).safeMessage
  }
  return "accepted"
}

describe("readImageInfo", () => {
  it.each([
    ["a real PNG", PNG_1X1, { type: "png", width: 1, height: 1 }],
    ["a JPEG", jpegHeader(128, 64), { type: "jpeg", width: 128, height: 64 }],
    ["a lossy WebP", webpVp8(300, 200), { type: "webp", width: 300, height: 200 }],
    ["a lossless WebP", webpVp8l(100, 50), { type: "webp", width: 100, height: 50 }],
    ["an extended WebP", webpVp8x(4000, 3000), { type: "webp", width: 4000, height: 3000 }],
    [
      "an AVIF, measured by its largest image",
      avifHeader([640, 480], [2000, 1500]),
      { type: "avif", width: 2000, height: 1500 },
    ],
  ])("reads %s", (_label, bytes, expected) => {
    expect(readImageInfo(bytes)).toEqual(expected)
  })

  it.each([
    [
      "an SVG",
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    ],
    ["a GIF", Buffer.from("GIF89a\x01\x00\x01\x00")],
    ["text named .png", Buffer.from("not an image at all")],
    ["a truncated PNG", PNG_1X1.subarray(0, 12)],
    [
      "a JPEG whose scan starts before any frame",
      Buffer.concat([
        jpegHeader(8, 8).subarray(0, 20),
        Buffer.from([0xff, 0xda]),
        Buffer.alloc(12),
      ]),
    ],
    ["sixteen bytes of text shaped like a WebP", Buffer.from("RIFFxxxxWEBPVP8X")],
    ["a WebP shorter than its RIFF size", webpVp8x(100, 100).subarray(0, 26)],
    [
      "a PNG whose IHDR length is not 13",
      (() => {
        const png = Buffer.from(PNG_1X1)
        png.writeUInt32BE(12, 8)
        return png
      })(),
    ],
    [
      "an AVIF hiding its real size behind 64 decoy properties",
      avifHeader([1, 1], ...new Array<[number, number]>(63).fill([1, 1]), [65_535, 65_535]),
    ],
    [
      "a HEIC",
      Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(12)]),
    ],
    ["empty", Buffer.alloc(0)],
  ])("refuses %s", (_label, bytes) => {
    expect(readImageInfo(bytes)).toBeNull()
  })
})

describe("storedName", () => {
  const png = { type: "png", width: 1, height: 1 } as const

  it.each([
    ["an HTML name on PNG bytes", "logo.html", png, "logo.png"],
    ["a Turkish name with a path", "../../Şef Bıçağı.JPG", png, "sef-bicagi.png"],
    ["a name with no letters left", "%%%.png", png, "file.png"],
    ["a CSV", "Ürünler.csv", { type: "csv" } as const, "urunler.csv"],
  ])("stores %s by what its bytes are", (_label, name, accepted, expected) => {
    expect(storedName(name, accepted)).toBe(expected)
  })
})

describe("validateUpload", () => {
  const upload =
    (buffer: Buffer, originalname = "x.png") =>
    () =>
      validateUpload({ buffer, originalname })

  it("accepts an image whatever its name says", () => {
    expect(validateUpload({ buffer: PNG_1X1, originalname: "photo.jpg" })).toMatchObject({
      type: "png",
    })
  })

  it.each([
    ["an SVG", Buffer.from("<svg/>"), "logo.svg", "upload.unsupported_type"],
    ["a fake MIME (text called .png)", Buffer.from("hello"), "x.png", "upload.unsupported_type"],
    [
      "a decompression bomb (huge canvas)",
      pngHeader(50_000, 50_000),
      "x.png",
      "upload.dimensions_too_large",
    ],
    ["a side over 10 000 px", pngHeader(12_000, 10), "x.png", "upload.dimensions_too_large"],
    [
      "a file over 10 MB",
      Buffer.concat([PNG_1X1, Buffer.alloc(11 * 1024 * 1024)]),
      "x.png",
      "upload.too_large",
    ],
    [
      "a binary called .csv",
      Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]),
      "products.csv",
      "upload.unsupported_type",
    ],
  ])("refuses %s", (_label, buffer, name, reason) => {
    expect(reasonOf(upload(buffer, name))).toBe(reason)
  })

  it("accepts a plain UTF-8 CSV for Medusa's product import", () => {
    expect(
      validateUpload({
        buffer: Buffer.from("Product Handle,Title\nsef-bicagi,Şef Bıçağı\n"),
        originalname: "urunler.csv",
      })
    ).toEqual({
      type: "csv",
    })
  })
})

describe("escapeCsvCell", () => {
  it.each([
    ["a formula", '=HYPERLINK("http://x")', '"\'=HYPERLINK(""http://x"")"'],
    ["a plus", "+905321234567", "'+905321234567"],
    ["a minus text", "-2+3", "'-2+3"],
    ["an at sign", "@SUM(A1)", "'@SUM(A1)"],
    ["a leading tab", "\tcmd", '"\'\tcmd"'],
    ["a formula after a semicolon (Excel in a Turkish locale)", "x;=1+1;", '"x;\'=1+1;"'],
    ["a formula after a comma and spaces", "a, @SUM(A1)", '"a, \'@SUM(A1)"'],
    ["a formula after a leading space", " =1", '" \'=1"'],
    ["a formula after a no-break space", "\u00a0=1", '"\u00a0\'=1"'],
    ["a fullwidth equals sign", "\uff1d1+1", "'\uff1d1+1"],
    ["a minus inside a word", "Ali-Veli", "Ali-Veli"],
    ["a comma", "a,b", '"a,b"'],
    ["a line break", "a\nb", '"a\nb"'],
    ["plain text", "Şef Bıçağı", "Şef Bıçağı"],
    ["a negative number, kept a number", -5, "-5"],
    ["null", null, ""],
    ["an invalid date", new Date("nope"), ""],
  ])("handles %s", (_label, value, expected) => {
    expect(escapeCsvCell(value)).toBe(expected)
  })

  it("leaves a value that cannot be written as JSON empty instead of failing the export", () => {
    const cycle: Record<string, unknown> = {}
    cycle["self"] = cycle

    expect(escapeCsvCell(cycle)).toBe("")
  })

  it("joins rows with CRLF and ends with one", () => {
    expect(
      toCsv([
        ["a", 1],
        ["=b", null],
      ])
    ).toBe("a,1\r\n'=b,\r\n")
  })
})

describe("parseXmlSafely", () => {
  it("parses ordinary XML and keeps values as text", () => {
    expect(
      parseXmlSafely("<feed><item><id>1</id><postcode>06100</postcode></item></feed>")
    ).toEqual({
      feed: { item: { id: "1", postcode: "06100" } },
    })
  })

  it("refuses nesting deeper than the parser should recurse", () => {
    const deep = `${"<a>".repeat(200_000)}${"</a>".repeat(200_000)}`

    expect(reasonOf(() => parseXmlSafely(deep))).toBe("xml.too_deep")
  })

  it.each(["__proto__", "constructor"])("refuses a <%s> tag (prototype pollution)", (tag) => {
    expect(
      reasonOf(() => parseXmlSafely(`<root><${tag}><polluted>yes</polluted></${tag}></root>`))
    ).toBe("xml.invalid")
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined()
  })

  it.each([
    [
      "an external entity (XXE)",
      '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>',
      "xml.doctype_not_allowed",
    ],
    [
      "an entity bomb",
      '<!DOCTYPE l [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;">]><l>&b;</l>',
      "xml.doctype_not_allowed",
    ],
    ["a lowercase doctype", "<!doctype x><x/>", "xml.doctype_not_allowed"],
    ["malformed XML", "<a><b></a>", "xml.invalid"],
  ])("refuses %s", (_label, text, reason) => {
    expect(reasonOf(() => parseXmlSafely(text))).toBe(reason)
  })

  it("refuses XML over the size limit", () => {
    expect(reasonOf(() => parseXmlSafely(`<a>${"x".repeat(200)}</a>`, { maxBytes: 100 }))).toBe(
      "xml.too_large"
    )
  })

  it("leaves entity references as they are", () => {
    expect(parseXmlSafely("<a>&amp;lt;</a>")).toEqual({ a: "&amp;lt;" })
  })
})
