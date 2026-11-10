import { render, screen } from "@testing-library/react"
import { Truck } from "lucide-react"
import { describe, expect, it } from "vitest"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "./alert"

// jsdom draws nothing: the layout is held by the classes that make it (docs/18 §2)
describe("Alert", () => {
  it("draws its icon in a box one text line tall, level with the first line", () => {
    render(
      <Alert>
        <Truck aria-hidden="true" />
        <AlertTitle>Etiket hazır</AlertTitle>
        <AlertDescription>
          <p>Etiketi yazdırıp koliye yapıştırın.</p>
        </AlertDescription>
      </Alert>
    )
    const alert = screen.getByRole("alert")
    // Every line 20 px; the icon's box `1lh` of that, its 16 px glyph in the middle
    expect(alert).toHaveClass("text-sm", "leading-5", "items-start")
    expect(alert).toHaveClass("[&>svg]:h-lh", "[&>svg]:w-4", "[&>svg]:row-start-1")
    // No nudge that holds for one line height only
    expect(alert.className).not.toMatch(/translate-y/)
    expect(screen.getByText("Etiket hazır")).toHaveClass("min-h-5")
    const description = alert.querySelector("[data-slot=alert-description]")
    expect(description).toHaveClass("leading-5")
    // A paragraph inside keeps the 20 px line (no `leading-relaxed`)
    expect(description?.className).not.toMatch(/leading-relaxed/)
  })

  it("centres its buttons on the first line, right of the words (the owner, 2026-11-09)", () => {
    render(
      <Alert>
        <Truck aria-hidden="true" />
        <AlertDescription>Kolinin etiketi hazır.</AlertDescription>
        <AlertAction>
          <button type="button">Etiketi indir</button>
        </AlertAction>
      </Alert>
    )
    const alert = screen.getByRole("alert")
    const action = screen.getByRole("button", { name: "Etiketi indir" }).parentElement
    expect(action).toHaveAttribute("data-slot", "alert-action")
    // Its own column on the first row; a 32 px button less 6 px above and below is the 20 px line
    expect(action).toHaveClass("sm:col-start-3", "sm:row-start-1", "sm:-my-1.5")
    // On a phone under the words
    expect(action).toHaveClass("col-start-2", "mt-2")
    // The words are not a flex row centring themselves on the button
    expect(alert.querySelector("[data-slot=alert-description]")?.className).not.toMatch(
      /items-center/
    )
    expect(alert).toHaveClass("has-[>[data-slot=alert-action]]:py-3.5")
  })
})
