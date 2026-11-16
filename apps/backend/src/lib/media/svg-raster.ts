import sharp from "sharp"
import { MAX_INPUT_PIXELS } from "./sanitize"

/** A raster draw of an SVG may take this long at most; one that does not end is dropped. */
const RASTER_TIMEOUT_SECONDS = 10

/** Apple's home screen icon takes no SVG: a PNG this size is made from the site icon. */
export const APPLE_TOUCH_SIDE = 180
/** Mail clients show no SVG: the logo's PNG fits this box (the mail shows it 32 px high). */
export const MAIL_LOGO_BOX = { width: 600, height: 200 }

/**
 * A PNG of a cleaned SVG (`svg.ts`), never of one as sent: drawn near
 * `side` px on its longer side whatever size it names (no huge canvas),
 * within the pixel limit and a time limit.
 */
async function draw(svg: Buffer, side: number) {
  const meta = await sharp(svg, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()
  const longest = Math.max(meta.width, meta.height, 1)
  const density = Math.min(2400, Math.max(1, Math.round((72 * side) / longest)))
  return sharp(svg, { density, limitInputPixels: MAX_INPUT_PIXELS }).timeout({
    seconds: RASTER_TIMEOUT_SECONDS,
  })
}

/** Apple's home screen icon: square, on white (Apple fills a transparent one with black). */
export async function appleTouchPng(svg: Buffer): Promise<Buffer> {
  return (await draw(svg, 512))
    .resize(APPLE_TOUCH_SIDE, APPLE_TOUCH_SIDE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer()
}

/** The logo for mail clients: within 600 × 200, its own shape, transparent ground kept. */
export async function mailLogoPng(svg: Buffer): Promise<Buffer> {
  return (await draw(svg, MAIL_LOGO_BOX.width))
    .resize(MAIL_LOGO_BOX.width, MAIL_LOGO_BOX.height, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer()
}
