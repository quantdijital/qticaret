import { describe, expect, it } from "vitest"
import {
  FRAME_MAX_HEIGHT,
  FRAME_MIN_HEIGHT,
  RESIZER_INIT,
  frameHeightOf,
  frameOriginOf,
} from "../lib/frame-resizer"

const PAYTR = "https://www.paytr.com"
const size = (height: number | string, type = "init", id = "paytriframe") =>
  `[iFrameSizer]${id}:${String(height)}:390:${type}`

describe("iframe-resizer's host side, as PayTR's form speaks it", () => {
  it("asks a page for its size as PayTR's own iFrameResize({}, '#paytriframe') does", () => {
    const fields = RESIZER_INIT.slice("[iFrameSizer]".length).split(":")
    expect(fields).toHaveLength(15)
    expect(fields[0]).toBe("paytriframe")
    // A content script knows the init message by its third field, a boolean
    expect(fields[2]).toBe("false")
    expect(fields[8]).toBe("bodyOffset")
  })

  it("takes the frame's height from its page's size messages", () => {
    expect(frameHeightOf(size(735), PAYTR, PAYTR)).toBe(735)
    expect(frameHeightOf(size("812.4", "mutationObserver"), PAYTR, PAYTR)).toBe(813)
    expect(frameHeightOf(`${size(600, "message")}:extra`, PAYTR, PAYTR)).toBeNull()
  })

  it("keeps the height within its bounds", () => {
    expect(frameHeightOf(size(12), PAYTR, PAYTR)).toBe(FRAME_MIN_HEIGHT)
    expect(frameHeightOf(size(99_999), PAYTR, PAYTR)).toBe(FRAME_MAX_HEIGHT)
  })

  it("ignores another origin, another frame, other messages and nonsense", () => {
    expect(frameHeightOf(size(735), "https://evil.example", PAYTR)).toBeNull()
    expect(frameHeightOf(size(735, "init", "other"), PAYTR, PAYTR)).toBeNull()
    expect(frameHeightOf(size(735, "scrollTo"), PAYTR, PAYTR)).toBeNull()
    expect(frameHeightOf(size("NaN"), PAYTR, PAYTR)).toBeNull()
    expect(frameHeightOf(size(-5), PAYTR, PAYTR)).toBeNull()
    expect(frameHeightOf("[iFrameSizer]paytriframe", PAYTR, PAYTR)).toBeNull()
    expect(frameHeightOf({ message: "shrink_iframe" }, PAYTR, PAYTR)).toBeNull()
    expect(frameHeightOf("shrink", PAYTR, PAYTR)).toBeNull()
  })

  it("reads the frame's origin from its address", () => {
    expect(
      frameOriginOf("https://www.paytr.com/odeme/guvenli/abc", "https://shop.tr/odeme/kart")
    ).toBe(PAYTR)
    expect(frameOriginOf("http://127.0.0.1:9102/odeme/guvenli/abc", "http://localhost:8000/")).toBe(
      "http://127.0.0.1:9102"
    )
    expect(frameOriginOf("data:text/html,x", "https://shop.tr/")).toBeNull()
    expect(frameOriginOf("http://[", "https://shop.tr/")).toBeNull()
  })
})
