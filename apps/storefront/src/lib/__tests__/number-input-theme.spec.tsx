// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
// The theme's own parts: it exports pages, not these
import { NumberInput } from "../../../../../packages/themes/atolye/src/parts/NumberInput"
import {
  nextValue,
  roundStep,
  stepCeiling,
} from "../../../../../packages/themes/atolye/src/parts/number-step"

/**
 * The listing's price fields (owner 2026-11-06: "artır azaltma ikonları
 * default kalmasın"): no browser spinner, the theme's own up / down
 * chevrons moving by a round step, held between the range's ends.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  host.remove()
})

const words = { increase: t("listing.price_increase"), decrease: t("listing.price_decrease") }
const rule = { min: 0, max: 600, step: 200, start: 150 }

function found<T extends Element>(node: T | null): T {
  if (!node) {
    throw new Error("not drawn")
  }
  return node
}

const field = () => found(host.querySelector<HTMLInputElement>("input"))
const arrow = (name: string) =>
  found(host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`))

function draw(defaultValue?: number) {
  act(() => {
    root.render(
      <NumberInput
        id="en-az"
        name="fiyat_en_az"
        rule={rule}
        words={words}
        defaultValue={defaultValue}
      />
    )
  })
}

function press(name: string) {
  act(() => {
    arrow(name).click()
  })
}

function key(name: "ArrowUp" | "ArrowDown") {
  act(() => {
    field().dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }))
  })
}

describe("the theme's number field", () => {
  it("is a real number field for its GET form, the chevrons drawn only with the script", () => {
    const html = renderToString(
      <NumberInput name="fiyat_en_az" rule={rule} words={words} defaultValue={300} />
    )
    expect(html).toContain('type="number"')
    expect(html).toContain('name="fiyat_en_az"')
    expect(html).toContain('inputMode="numeric"')
    expect(html).not.toContain("<button")
  })

  it("moves by its step with the chevrons and the arrow keys, from the example when empty", () => {
    draw()
    expect(words).toEqual({ increase: "Artır", decrease: "Azalt" })
    press("Artır")
    expect(field().value).toBe("200")
    press("Artır")
    expect(field().value).toBe("400")
    key("ArrowDown")
    expect(field().value).toBe("200")
    key("ArrowUp")
    expect(field().value).toBe("400")
    expect(arrow("Artır").tabIndex).toBe(-1)
  })

  it("stops at its ends, the chevron turned off there", () => {
    draw(500)
    press("Artır")
    expect(field().value).toBe("600")
    expect(arrow("Artır").disabled).toBe(true)
    press("Azalt")
    press("Azalt")
    press("Azalt")
    press("Azalt")
    expect(field().value).toBe("0")
    expect(arrow("Azalt").disabled).toBe(true)
  })

  it("shows the chevrons on hover or focus, never on a touch screen", () => {
    draw()
    const steps = host.querySelector("[data-number-steps]")
    expect(steps?.className).toContain("opacity-0")
    expect(steps?.className).toContain("group-hover/number:opacity-100")
    expect(steps?.className).toContain("group-focus-within/number:opacity-100")
    expect(steps?.className).toMatch(/\bhidden\b.*pointer-fine:flex/)
  })
})

describe("the number field's step", () => {
  it("lands on whole steps and keeps between min and max", () => {
    expect(nextValue("1234", 1, { min: 0, step: 100, start: 0 })).toBe(1300)
    expect(nextValue("1234", -1, { min: 0, step: 100, start: 0 })).toBe(1200)
    expect(nextValue("1200", -1, { min: 0, step: 100, start: 0 })).toBe(1100)
    expect(nextValue("", 1, { min: 0, step: 200, start: 150 })).toBe(200)
    expect(nextValue("abc", -1, { min: 0, step: 200, start: 150 })).toBe(0)
    expect(nextValue("590", 1, { min: 0, max: 600, step: 200, start: 0 })).toBe(600)
  })

  it("rounds a range's twentieth onto 1, 2 or 5 times a power of ten", () => {
    expect(roundStep(100, 4000)).toBe(200)
    expect(roundStep(150, 4125)).toBe(200)
    expect(roundStep(0, 900)).toBe(50)
    expect(roundStep(10, 20)).toBe(1)
    expect(stepCeiling(4125, 200)).toBe(4200)
  })
})
