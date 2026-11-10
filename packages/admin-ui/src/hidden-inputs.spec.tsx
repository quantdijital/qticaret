import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Checkbox } from "./ui/checkbox"
import { RadioGroup, RadioGroupItem } from "./ui/radio-group"
import { Switch } from "./ui/switch"

const CSS = readFileSync(join(import.meta.dirname, "styles.css"), "utf8")
// The rows styles.css positions: the parent of a Radix control and its hidden input
const ROW =
  ':has(> button:is([role="checkbox"], [role="radio"], [role="switch"]) + input[aria-hidden="true"])'

/**
 * 2026-11-03, /settings/marketing: Radix's hidden native input (absolutely
 * placed, beside the button, inside a form) escaped a list that scrolls
 * inside itself and stretched the page by ~1000 px. styles.css makes the
 * control's own row its containing block; this keeps that rule matching
 * the markup Radix renders.
 */
describe("hidden form inputs of Radix controls", () => {
  it("are kept by styles.css inside the row that holds the control", () => {
    const squash = (text: string) => text.replace(/\s+/g, "")
    expect(squash(CSS)).toContain(squash(ROW))
  })

  it("sit right after the control's button, so the rule finds their row", () => {
    render(
      <form>
        <ul>
          <li>
            <label data-testid="checkbox-row">
              <Checkbox /> Kategori
            </label>
          </li>
        </ul>
        <RadioGroup aria-label="Kategori">
          <label data-testid="radio-row">
            <RadioGroupItem value="a" /> A
          </label>
        </RadioGroup>
        <label data-testid="switch-row">
          <Switch /> Açık
        </label>
      </form>
    )
    for (const row of ["checkbox-row", "radio-row", "switch-row"]) {
      const element = screen.getByTestId(row)
      expect(element.querySelector('input[aria-hidden="true"]')).not.toBeNull()
      expect(element.matches(ROW)).toBe(true)
    }
  })
})
