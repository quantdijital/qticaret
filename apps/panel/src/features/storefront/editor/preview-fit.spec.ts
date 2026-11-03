import { describe, expect, it } from "vitest"
import { fitPreview } from "./preview-fit"

describe("the preview's fit", () => {
  it("scales a device wider than its room down as a whole, filling the room's height", () => {
    expect(fitPreview("desktop", { width: 640, height: 600 })).toEqual({
      width: 1280,
      height: 1200,
      scale: 0.5,
    })
    expect(fitPreview("tablet", { width: 384, height: 500 })).toEqual({
      width: 768,
      height: 1000,
      scale: 0.5,
    })
  })

  it("never shows a device larger than it is: a phone in a wide room stays a phone", () => {
    expect(fitPreview("mobile", { width: 1000, height: 700 })).toEqual({
      width: 390,
      height: 700,
      scale: 1,
    })
  })

  it("draws the desktop as wide as a room wider than a laptop", () => {
    expect(fitPreview("desktop", { width: 1600, height: 800 })).toEqual({
      width: 1600,
      height: 800,
      scale: 1,
    })
  })

  it("rounds the scale down, so the scaled frame never overshoots its room", () => {
    const fit = fitPreview("desktop", { width: 1000, height: 700 })
    expect(fit.scale).toBe(0.781)
    expect(fit.width * fit.scale).toBeLessThanOrEqual(1000)
    expect(fit.height * fit.scale).toBeLessThanOrEqual(700)
  })

  it("draws at the device's width while the room is not measured yet", () => {
    expect(fitPreview("tablet", { width: 0, height: 0 })).toEqual({
      width: 768,
      height: 0,
      scale: 1,
    })
  })
})
