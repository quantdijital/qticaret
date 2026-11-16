import { isValidationError } from "../../errors"
import { SVG_MAX_BYTES, sanitizeSvg } from "../svg"
import { cleanSvg } from "../svg-clean"

/**
 * The cleaner off the event loop (`svg.ts`): a worker thread per file, a
 * hard time limit, at most two at once. Here it loads the TypeScript
 * source through ts-node, as `medusa develop` does; built, the compiled
 * module (`.medusa/server`, checked by hand: see the PR).
 */

jest.setTimeout(120_000)

const LOGO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10" onload="alert(1)"><script>alert(2)</script><rect width="5" height="5" fill="#c00"/></svg>'
)

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return "kept"
  } catch (error) {
    return isValidationError(error) ? error.safeMessage : `thrown: ${String(error)}`
  }
}

describe("sanitizeSvg: the cleaner in a worker", () => {
  it("gives what the cleaner gives, byte for byte", async () => {
    const result = await sanitizeSvg(LOGO)
    expect(result.buffer.equals(cleanSvg(LOGO, SVG_MAX_BYTES).buffer)).toBe(true)
    expect([result.width, result.height]).toEqual([20, 10])
    expect(result.buffer.toString()).not.toMatch(/script|alert|onload/)
  })

  it("passes the cleaner's refusal on as its own", async () => {
    expect(await refusal(sanitizeSvg(Buffer.from("<svg><foreignObject><p>x</p>")))).toBe(
      "upload.svg_invalid"
    )
    expect(await refusal(sanitizeSvg(Buffer.from(`<svg>${"<g>".repeat(100)}`)))).toBe(
      "upload.svg_too_complex"
    )
  })

  it("ends a cleaning past its time limit and refuses the file as too complex", async () => {
    expect(await refusal(sanitizeSvg(LOGO, SVG_MAX_BYTES, { timeoutMs: 1 }))).toBe(
      "upload.svg_too_complex"
    )
    // The next one is not held by it
    expect((await sanitizeSvg(LOGO)).width).toBe(20)
  })

  it("fails the upload when no cleaner can start: never cleaning on the event loop instead", async () => {
    const outcome = await refusal(
      sanitizeSvg(LOGO, SVG_MAX_BYTES, { module: "/nowhere/svg-clean.js" })
    )
    expect(outcome).toMatch(/^thrown: /)
  })

  it("refuses a file past the limit before any worker starts", async () => {
    expect(await refusal(sanitizeSvg(LOGO, LOGO.length - 1))).toBe("upload.svg_too_large")
  })

  it("cleans several at once, two at a time, each to its own answer", async () => {
    const answers = await Promise.all(
      [10, 20, 30, 40].map((width) =>
        sanitizeSvg(
          Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(width)} 5"><rect width="1" height="1"/></svg>`
          )
        )
      )
    )
    expect(answers.map((answer) => answer.width)).toEqual([10, 20, 30, 40])
  })
})
