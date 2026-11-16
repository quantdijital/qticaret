import { SVG_MAX_BYTES } from "../svg"
import { SvgRefusal, cleanSvg } from "../svg-clean"
import { cleanDeclarations, cleanStyleSheet, valueReachesOut } from "../svg-css"
import { looksLikeSvg, plainNumber, prescan } from "../svg-scan"

/**
 * The security review's payloads (2026-11-16), each of which held the old
 * patterns for seconds or for good (measured before the fix: the comment
 * run never ended in 20 s, `<a` × 2,000 took 2 s and × 20,000 never ended,
 * 190,000 spaces took 18 s, `<!-->` hid 4,000 tags from the count). Every
 * read before parsing is now a linear loop; the cleaner runs in a worker
 * besides (svg-worker.unit.spec.ts).
 *
 * The clock limits catch a hang, not a slow machine: a linear read here
 * takes a millisecond or less, the old patterns seconds or for ever, and a
 * busy shared CI runner can pause any one call for hundreds of ms (GC, its
 * neighbours: 388 ms seen on a 100 ms limit). Two seconds tells them apart;
 * that a read is linear the size test shows with no clock limit. YENİ-4
 * keeps a second on purpose: there the cleaner must refuse before it
 * parses, and a parse of that tree alone takes more (1.3 s and up).
 */

const HANG_MS = 2_000

const timed = <T>(run: () => T): { value: T; ms: number } => {
  const started = performance.now()
  const value = run()
  return { value, ms: performance.now() - started }
}

function cleaned(text: string): string {
  try {
    cleanSvg(Buffer.from(text), SVG_MAX_BYTES)
    return "kept"
  } catch (error) {
    return error instanceof SvgRefusal ? error.safeMessage : "thrown"
  }
}

describe("the review's payloads, under a hard time limit", () => {
  it("YENİ-1: a run of comments is no SVG, at once (it reached looksLikeSvg on every upload)", () => {
    const { value, ms } = timed(() => looksLikeSvg(Buffer.from(`${"<!---->".repeat(40)}x`)))
    expect(value).toBe(false)
    expect(ms).toBeLessThan(HANG_MS)
    // Still an SVG after comments, a declaration and a DOCTYPE with its subset
    expect(
      looksLikeSvg(
        Buffer.from(
          '<?xml version="1.0"?>\n<!-- a --><!DOCTYPE svg [<!ENTITY a ">">]>\n<!-- b -->\n<svg viewBox="0 0 1 1">'
        )
      )
    ).toBe(true)
  })

  it.each([
    ["YENİ-2: <svg> and <a × 2,000", `<svg>${"<a".repeat(2_000)}`],
    ["YENİ-2: <a × 20,000", "<a".repeat(20_000)],
  ])("%s is read once, linearly", (_name, text) => {
    const { ms } = timed(() => prescan(text))
    expect(ms).toBeLessThan(HANG_MS)
    const whole = timed(() => cleaned(text))
    expect(whole.ms).toBeLessThan(HANG_MS)
  })

  it("YENİ-3: a width of 190,000 spaces is no number, at once", () => {
    const { value, ms } = timed(() => plainNumber(`1${" ".repeat(190_000)}x`))
    expect(value).toBeNull()
    expect(ms).toBeLessThan(HANG_MS)
    expect(plainNumber(" 64px ")).toBe(64)
  })

  it("YENİ-4: an empty comment hides no tags from the count", () => {
    const text = `<svg><!-->${"<a>".repeat(4_000)}`
    expect(prescan(text)).toBe("upload.svg_too_complex")
    expect(prescan(`<svg><!--->${"<g>".repeat(100)}`)).toBe("upload.svg_too_complex")
    const { value, ms } = timed(() => cleaned(text))
    expect(value).toBe("upload.svg_too_complex")
    expect(ms).toBeLessThan(1_000)
  })

  it.each([
    ["B2: a comment closed by --!> hides no tags", `<svg><!----!>${"<g>".repeat(60_000)}`],
    ["B2: attributes without values count", `<svg><rect ${"a ".repeat(25_000)}/></svg>`],
    ["B2: a quoted > ends no tag", `<svg>${'<g a=">">'.repeat(100)}`],
    ["B2: a / in an unquoted value closes nothing", `<svg>${"<g a=/>".repeat(100)}`],
    ["B2: an HTML element's / closes nothing", `<svg><foreignObject>${"<div/>".repeat(100)}`],
    ["B3: a template", "<svg><template><rect/></template></svg>"],
  ])("%s: refused before it is parsed", (_name, text) => {
    const { value, ms } = timed(() => prescan(text))
    expect(value).toBe("upload.svg_too_complex")
    expect(ms).toBeLessThan(HANG_MS)
  })

  it("keeps a logo's many shapes that close themselves", () => {
    const shapes = '<path d="M0 0h1v1z"/>'.repeat(200)
    expect(prescan(`<svg xmlns="http://www.w3.org/2000/svg">${shapes}</svg>`)).toBeNull()
    expect(
      cleaned(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">${shapes}</svg>`)
    ).toBe("kept")
  })

  it("B3: the cleaner refuses a template (the text's look first, the parsed tree behind it)", () => {
    expect(cleaned("<svg><template><rect/></template></svg>")).toBe("upload.svg_too_complex")
  })

  it("YENİ-5: an element with 25,000 attributes is refused before it is parsed", () => {
    const text = `<svg><rect ${"a=1 ".repeat(25_000)}/></svg>`
    expect(prescan(text)).toBe("upload.svg_too_complex")
    const { value, ms } = timed(() => cleaned(text))
    expect(value).toBe("upload.svg_too_complex")
    expect(ms).toBeLessThan(HANG_MS)
    // Many elements of a few attributes each, past the total
    expect(prescan(`<svg>${'<rect x="1" y="1" width="1" height="1"/>'.repeat(5_001)}`)).toBe(
      "upload.svg_too_complex"
    )
  })

  it("reads CSS and attribute values linearly too", () => {
    const letters = "a".repeat(150_000)
    const runs: (() => unknown)[] = [
      () => valueReachesOut("url(".repeat(40_000)),
      () => cleanDeclarations(`fill:${letters}`),
      () => cleanStyleSheet("/*".repeat(60_000)),
      () => cleanStyleSheet(`.a{fill:${letters}(}`),
    ]
    for (const run of runs) {
      expect(timed(run).ms).toBeLessThan(HANG_MS)
    }
  })
})

const fill = (piece: string, length: number) => piece.repeat(Math.ceil(length / piece.length))

// The fastest of seven runs, the two sizes in turn: a pause only lengthens a
// run, and a runner slowed throughout slows both sizes alike
function fastest(small: () => unknown, large: () => unknown): [number, number] {
  small()
  large()
  let best: [number, number] = [Infinity, Infinity]
  for (let turn = 0; turn < 7; turn++) {
    best = [Math.min(best[0], timed(small).ms), Math.min(best[1], timed(large).ms)]
  }
  return best
}

const SHAPES: [string, (length: number) => string][] = [
  ["a run of <a (YENİ-2)", (length) => `<svg>${fill("<a", length)}`],
  ["a run of comments", (length) => `<svg>${fill("<!---->", length)}`],
  ["attributes without values", (length) => `<svg><rect ${fill("a ", length)}/></svg>`],
  ["a comment never closed", (length) => `<svg><!--${fill("-", length)}`],
]

describe("linear by the ratio, not the clock: eight times the text, about eight times the read", () => {
  it.each(SHAPES)("%s", (_name, shape) => {
    const small = shape(SVG_MAX_BYTES / 8)
    const large = shape(SVG_MAX_BYTES)
    const [fast, slow] = fastest(
      () => prescan(small),
      () => prescan(large)
    )
    // Linear reads about 8 (measured 7.5 to 8.5), a quadratic one about 64
    expect(slow / Math.max(fast, 0.01)).toBeLessThan(24)
  })
})

// A small seeded generator: the same inputs every run
function mulberry32(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const PIECES = [
  "<svg>",
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">',
  "</svg>",
  "<g>",
  "</g>",
  "<a",
  "<a>",
  "<x>",
  "<!--",
  "-->",
  "<!-->",
  "<!--->",
  "<![CDATA[",
  "]]>",
  '<!DOCTYPE svg [<!ENTITY a "b">]>',
  '<?xml version="1.0"?>',
  '<rect width="1" height="1"/>',
  ' a="1"',
  " b=2",
  "<style>.a{fill:url(#g)}</style>",
  '<path d="M0 0L1 1"/>',
  "url(",
  "/*",
  "\\",
  "  ",
  "\n",
  ">",
  "<",
  "=",
  '"',
]

function generate(random: () => number, size: number): string {
  const parts: string[] = []
  let length = 0
  while (length < size) {
    const piece = PIECES[Math.floor(random() * PIECES.length)] ?? ""
    const times = random() < 0.1 ? Math.floor(random() * 2_000) : 1
    const chunk = piece.repeat(times)
    parts.push(chunk)
    length += chunk.length
  }
  return parts.join("").slice(0, size)
}

describe("generated inputs (fixed seed): an answer, never a hang", () => {
  const random = mulberry32(20_261_116)
  const inputs = Array.from({ length: 300 }, (_, index) =>
    generate(random, index % 10 === 0 ? 200 * 1024 : Math.floor(random() * 8_192))
  )

  it("reads every one's start and tags linearly", () => {
    // Each within the hang limit: a pause on one call is no hang; the ratio test shows linear
    for (const input of inputs) {
      const bytes = Buffer.from(input)
      const { ms } = timed(() => [looksLikeSvg(bytes), prescan(input)])
      expect(ms).toBeLessThan(HANG_MS)
    }
  })

  it("cleans or refuses each within its limit", () => {
    // The cleaner parses: a hard bound per input, the worker's own limit besides
    for (const input of inputs.filter((_, index) => index % 5 === 0)) {
      const { value, ms } = timed(() => cleaned(input))
      expect([
        "kept",
        "upload.svg_invalid",
        "upload.svg_too_complex",
        "upload.svg_too_large",
      ]).toContain(value)
      expect(ms).toBeLessThan(HANG_MS)
    }
  })
})
