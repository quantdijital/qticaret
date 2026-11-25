import sharp from "sharp"
import { isProviderError } from "../../errors/errors"
import { laidOnWhite } from "../on-white"
import { findAiService } from "../registry/services"
import type { AiService } from "../registry/services"

/**
 * A service's cut-out laid on white (lib/ai/on-white.ts): the bytes are
 * the service's, so their type is read from the first bytes before any
 * decoder sees them; a PNG or WebP alone goes on.
 */

jest.setTimeout(30_000)

function briaService(): AiService {
  const service = findAiService("bria", "production")
  if (!service) {
    throw new Error("no Bria service")
  }
  return service
}

const clear = () =>
  sharp({
    create: { width: 16, height: 12, channels: 4, background: { r: 0, g: 90, b: 0, alpha: 0 } },
  })

async function refusal(run: Promise<unknown>) {
  const error: unknown = await run.then(
    () => {
      throw new Error("expected a refusal")
    },
    (thrown: unknown) => thrown
  )
  if (!isProviderError(error)) {
    throw error
  }
  return { key: error.safeMessage, code: error.providerCode }
}

describe("laidOnWhite", () => {
  it("lays a PNG or WebP cut-out on white as a JPEG", async () => {
    for (const bytes of [await clear().png().toBuffer(), await clear().webp().toBuffer()]) {
      const white = await laidOnWhite(briaService(), bytes)
      const meta = await sharp(white).metadata()
      expect([meta.format, meta.hasAlpha]).toEqual(["jpeg", false])
    }
  })

  it("refuses what its first bytes do not show as a PNG or WebP, before decoding it", async () => {
    const refused = { key: "ai.provider_response_invalid", code: "result_not_a_cut_out" }
    const inputs = [
      // Types sharp would read, but no cut-out comes back as one
      await clear().jpeg().toBuffer(),
      await clear().gif().toBuffer(),
      await clear().tiff().toBuffer(),
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9"/>'),
      Buffer.from("not a picture"),
      Buffer.alloc(0),
    ]
    for (const bytes of inputs) {
      expect(await refusal(laidOnWhite(briaService(), bytes))).toEqual(refused)
    }
  })

  it("names a PNG whose body cannot be read the service's fault too", async () => {
    const png = await clear().png().toBuffer()
    // The header (signature and IHDR) whole, the image data cut off
    expect(await refusal(laidOnWhite(briaService(), png.subarray(0, 40)))).toEqual({
      key: "ai.provider_response_invalid",
      code: "result_not_laid_on_white",
    })
  })
})
