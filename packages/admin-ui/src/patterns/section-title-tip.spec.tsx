import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { FieldHints } from "../hooks/use-field-hints"
import { SectionOwner } from "../hooks/use-section-open"
import { CollapsibleSection } from "./collapsible-section"
import { FormSection } from "./form-section"
import { SectionCard } from "./section-card"

const ABOUT = "İlk görsel ana görseldir; en çok 20 görsel."

const tip = () => screen.getByRole("button", { name: "Bilgi: Görseller" })

/**
 * A card's sentence under its title (docs/18 §7.1, the owner's "yazı
 * kalabalığı"): under `FieldHints style="tip"` it folds into an (i) beside
 * the title; everywhere else it stays a line.
 */
describe("a card's description", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("folds into the (i) beside a SectionCard's title under FieldHints tip", async () => {
    const user = userEvent.setup()
    render(
      <FieldHints style="tip">
        <SectionCard title="Görseller" description={ABOUT}>
          <p>içerik</p>
        </SectionCard>
      </FieldHints>
    )
    expect(tip()).toHaveAccessibleDescription(ABOUT)
    expect(screen.getByText(ABOUT)).toHaveClass("sr-only")
    await user.pointer({ keys: "[TouchA]", target: tip() })
    expect(await screen.findByRole("tooltip")).toHaveTextContent(ABOUT)
  })

  it("stays a line under the title everywhere else", () => {
    render(
      <SectionCard title="Görseller" description={ABOUT}>
        <p>içerik</p>
      </SectionCard>
    )
    expect(screen.queryByRole("button", { name: /Bilgi/ })).toBeNull()
    expect(screen.getByText(ABOUT)).not.toHaveClass("sr-only")
  })

  it("folds in a FormSection too", () => {
    render(
      <FieldHints style="tip">
        <FormSection title="Görseller" description={ABOUT}>
          <p>içerik</p>
        </FormSection>
      </FieldHints>
    )
    expect(tip()).toHaveAccessibleDescription(ABOUT)
  })

  it("opens behind the (i) of an open folding card, a tap on it leaving the card open", async () => {
    const user = userEvent.setup()
    render(
      <SectionOwner value={() => "user_1"}>
        <FieldHints style="tip">
          <CollapsibleSection
            id="media"
            name="test.media"
            title="Görseller"
            description={ABOUT}
            summary="4 görsel"
            defaultOpen
          >
            <p>içerik</p>
          </CollapsibleSection>
        </FieldHints>
      </SectionOwner>
    )
    const toggle = screen.getByRole("button", { name: "Görseller" })
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    // The sentence is no longer the open card's line
    expect(toggle).not.toHaveAccessibleDescription(ABOUT)
    await user.pointer({ keys: "[TouchA]", target: tip() })
    expect(await screen.findByRole("tooltip")).toHaveTextContent(ABOUT)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
  })
})
