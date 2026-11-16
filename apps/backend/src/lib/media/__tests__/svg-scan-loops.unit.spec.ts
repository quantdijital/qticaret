import { spawnSync } from "node:child_process"
import { join } from "node:path"

/**
 * The text reads that run on the event loop (`svg-scan.ts`: `looksLikeSvg`
 * on every upload not read as an image, `prescan`) must end on any input.
 * A loop that does not end would hold Jest itself, so each run here is a
 * child process with a hard kill: a hang fails the test, it never hangs it
 * (security review 2026-11-16, B1: `<!----><!doctype [>` looped for good).
 */

jest.setTimeout(120_000)

const SCAN = join(__dirname, "../svg-scan.ts")
const TS_NODE = require.resolve("ts-node")

function inChild(body: string, timeoutMs: number): { status: number | null; out: string } {
  const script = `
require(${JSON.stringify(TS_NODE)}).register({ transpileOnly: true, swc: true })
const { looksLikeSvg, prescan } = require(${JSON.stringify(SCAN)})
${body}
`
  const run = spawnSync(process.execPath, ["-e", script], {
    timeout: timeoutMs,
    killSignal: "SIGKILL",
    encoding: "utf8",
    cwd: join(__dirname, "../../../.."),
  })
  return { status: run.status, out: `${run.stdout}${run.stderr}` }
}

describe("the event loop's SVG reads end on any input", () => {
  it.each([
    ["a DOCTYPE subset never closed, after a comment", "<!----><!doctype [>"],
    ["a DOCTYPE subset never closed, after a declaration", "<?xml?><!doctype[>"],
    ["a DOCTYPE with no end at all", "<!----><!doctype ["],
    ["a comment closed by --!>", "<!----!><svg>"],
    ["an empty comment", "<!--><svg>"],
  ])("%s", (_name, input) => {
    const { status, out } = inChild(
      `const text = ${JSON.stringify(input)}
const answer = [looksLikeSvg(Buffer.from(text)), prescan(text)]
console.log("done", JSON.stringify(answer))`,
      10_000
    )
    expect([status, out.trim().split("\n").pop()?.startsWith("done")]).toEqual([0, true])
  })

  it("ends on thousands of generated short inputs (fixed seed), unbalanced brackets above all", () => {
    const { status, out } = inChild(
      `
let state = 20261116
const random = () => {
  state = (state + 0x6d2b79f5) | 0
  let t = Math.imul(state ^ (state >>> 15), 1 | state)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const PIECES = ["<", ">", "!", "-", "[", "]", "?", "/", "=", '"', "'", " ", "\\n", "doctype",
  "DOCTYPE", "xml", "svg", "a", "<!--", "-->", "--!>", "<!doctype", "<?xml", "?>", "<svg", "</",
  "<![CDATA[", "]]>", "\\uFEFF", "<a", "<g>", "</g>", "template"]
let count = 0
for (let i = 0; i < 6000; i++) {
  let text = ""
  const parts = 1 + Math.floor(random() * 24)
  for (let p = 0; p < parts; p++) {
    text += PIECES[Math.floor(random() * PIECES.length)]
  }
  looksLikeSvg(Buffer.from(text))
  prescan(text)
  count++
}
console.log("ran", count)`,
      60_000
    )
    expect(status).toBe(0)
    expect(out).toContain("ran 6000")
  })
})
