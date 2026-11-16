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
 */

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
    expect(ms).toBeLessThan(50)
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
    expect(ms).toBeLessThan(50)
    const whole = timed(() => cleaned(text))
    expect(whole.ms).toBeLessThan(2_000)
  })

  it("YENİ-3: a width of 190,000 spaces is no number, at once", () => {
    const { value, ms } = timed(() => plainNumber(`1${" ".repeat(190_000)}x`))
    expect(value).toBeNull()
    expect(ms).toBeLessThan(50)
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

  it("YENİ-5: an element with 25,000 attributes is refused before it is parsed", () => {
    const text = `<svg><rect ${"a=1 ".repeat(25_000)}/></svg>`
    const { value, ms } = timed(() => cleaned(text))
    expect(value).toBe("upload.svg_too_complex")
    expect(ms).toBeLessThan(1_000)
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
      expect(timed(run).ms).toBeLessThan(200)
    }
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
    for (const input of inputs) {
      const bytes = Buffer.from(input)
      const { ms } = timed(() => [looksLikeSvg(bytes), prescan(input)])
      expect(ms).toBeLessThan(100)
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
      expect(ms).toBeLessThan(2_000)
    }
  })
})
