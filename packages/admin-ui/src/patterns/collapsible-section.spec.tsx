import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SectionOwner, revealSection } from "../hooks/use-section-open"
import { CollapsibleSection } from "./collapsible-section"

function Section({
  attention = false,
  dirty = false,
  defaultOpen = false,
}: {
  attention?: boolean
  dirty?: boolean
  defaultOpen?: boolean
}) {
  return (
    <CollapsibleSection
      id="page-seo"
      name="test.seo"
      title="Arama motoru görünümü"
      description="Boş alanlar şablondan oluşur."
      summary="Başlık 56/60 · Açıklama 133/155 · 2 öneri"
      attention={attention}
      dirty={dirty}
      defaultOpen={defaultOpen}
    >
      <label>
        SEO başlığı
        <input />
      </label>
    </CollapsibleSection>
  )
}

function renderSection(props: Parameters<typeof Section>[0] = {}, user = "user_1") {
  // The app tells the sections who is signed in (the panel: its current user)
  const owner = () => user
  const view = render(
    <SectionOwner value={owner}>
      <Section {...props} />
    </SectionOwner>
  )
  return {
    ...view,
    rerender: (next: Parameters<typeof Section>[0]) => {
      view.rerender(
        <SectionOwner value={owner}>
          <Section {...next} />
        </SectionOwner>
      )
    },
  }
}

const toggle = () => screen.getByRole("button", { name: "Arama motoru görünümü" })
const field = () => screen.queryByRole("textbox", { name: "SEO başlığı" })

/** The owner, 2026-11-05: secondary parts fold so the main content stays in sight. */
describe("CollapsibleSection", () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("starts closed with its one-line summary, and opens to its fields and description", async () => {
    renderSection()
    expect(toggle()).toHaveAttribute("aria-expanded", "false")
    expect(toggle()).toHaveAccessibleDescription("Başlık 56/60 · Açıklama 133/155 · 2 öneri")
    expect(field()).not.toBeInTheDocument()

    await userEvent.click(toggle())
    expect(toggle()).toHaveAttribute("aria-expanded", "true")
    expect(toggle()).toHaveAccessibleDescription("Boş alanlar şablondan oluşur.")
    expect(field()).toBeVisible()

    await userEvent.click(toggle())
    expect(field()).not.toBeInTheDocument()
  })

  it("keeps a closed section's fields and their edits, and says an edit is unsaved", async () => {
    const { rerender } = renderSection({ defaultOpen: true })
    await userEvent.type(screen.getByRole("textbox", { name: "SEO başlığı" }), "Kupa")
    await userEvent.click(toggle())
    rerender({ dirty: true })

    expect(toggle()).toHaveAccessibleDescription("Kaydedilmemiş değişiklik var")
    await userEvent.click(toggle())
    expect(screen.getByRole("textbox", { name: "SEO başlığı" })).toHaveValue("Kupa")
  })

  it("remembers the person's choice for the next visit, per user", async () => {
    const first = renderSection()
    await userEvent.click(toggle())
    first.unmount()

    const again = renderSection()
    expect(toggle()).toHaveAttribute("aria-expanded", "true")
    expect(localStorage.getItem("qt.panel.section:user_1:test.seo")).toBe("1")
    again.unmount()

    // Another person in the same browser has their own
    renderSection({}, "user_2")
    expect(toggle()).toHaveAttribute("aria-expanded", "false")
  })

  it("opens when something in it needs attention, also after a closed choice and once it is known", async () => {
    localStorage.setItem("qt.panel.section:user_1:test.seo", "0")
    const { unmount } = renderSection({ attention: true })
    expect(toggle()).toHaveAttribute("aria-expanded", "true")
    unmount()

    const later = renderSection({ attention: false })
    expect(toggle()).toHaveAttribute("aria-expanded", "false")
    later.rerender({ attention: true })
    expect(toggle()).toHaveAttribute("aria-expanded", "true")
    // Opened for attention, not by choice: the closed choice stays
    expect(localStorage.getItem("qt.panel.section:user_1:test.seo")).toBe("0")
    await userEvent.click(toggle())
    expect(toggle()).toHaveAttribute("aria-expanded", "false")
  })

  it("works when the browser refuses storage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    renderSection()
    await userEvent.click(toggle())
    expect(toggle()).toHaveAttribute("aria-expanded", "true")
  })

  it("opens a closed section and scrolls to it for the advisor's go to field", () => {
    renderSection()
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView")
    act(() => {
      revealSection("page-seo")
    })
    expect(toggle()).toHaveAttribute("aria-expanded", "true")
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" })
  })
})
