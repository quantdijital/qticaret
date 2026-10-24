import { logger } from "../../src/lib/logging"

const CAPTURE_PROBE = "test.capture_probe"

/**
 * Collects everything written to stdout/stderr while `run` executes. A probe
 * line through the platform logger proves the logger's output is captured,
 * so "never appears in the logs" assertions cannot pass on an empty capture.
 */
export async function captureOutput(run: () => Promise<void>): Promise<string> {
  const chunks: string[] = []
  const spies = [process.stdout, process.stderr].map((stream) =>
    jest.spyOn(stream, "write").mockImplementation((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"))
      return true
    })
  )
  try {
    logger.info({ event: CAPTURE_PROBE })
    await run()
  } finally {
    spies.forEach((spy) => {
      spy.mockRestore()
    })
  }
  const output = chunks.join("")
  if (!output.includes(CAPTURE_PROBE)) {
    throw new Error("captureOutput saw none of the logger's output")
  }
  return output
}
