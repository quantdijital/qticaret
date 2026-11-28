import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { AnySection, PostsSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import "@/lib/i18n"
import en from "@/locales/en.json"
import tr from "@/locales/tr.json"
import { SectionPanel } from "../section-panel"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

/** The section's panel with its problems as the editor finds them: every change kept. */
function renderPanel(section: AnySection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <SectionPanel
        section={value}
        group="home"
        problems={sectionProblems(value)}
        canDuplicate
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
        onPlace={vi.fn()}
        onBack={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        badges={[]}
        onBadges={vi.fn()}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Holder />
    </QueryClientProvider>
  )
  return changes
}

const eyebrowField = () => screen.getByRole("textbox", { name: /^Üst satır/ })
const noteField = () => screen.getByRole("textbox", { name: /^El yazısı not/ })

describe("a section heading's upper line and hand note in the panel (sahip 2026-11-28)", () => {
  it("names both lines in both languages", () => {
    for (const words of [tr, en]) {
      const { headLines } = words.storefront.editor
      expect(headLines.eyebrowHint && headLines.eyebrowPlaceholder).toBeTruthy()
      for (const key of ["label", "term", "placeholder", "hint"] as const) {
        expect(headLines.note[key]).toBeTruthy()
      }
    }
  })

  it.each(["products", "categories", "departures", "reviews", "posts"] as const)(
    "takes %s's two lines, empty at first, under its title",
    async (type) => {
      const user = userEvent.setup()
      const changes = renderPanel(newHomeSection(type, "bolum00001"))
      expect(eyebrowField()).toHaveValue("")
      expect(eyebrowField()).toHaveAttribute("id", "bolum00001-eyebrow")
      expect(noteField()).toHaveValue("")
      expect(noteField()).toHaveAttribute("id", "bolum00001-note")

      await user.click(eyebrowField())
      await user.paste("Popüler rotalar")
      expect(changes.at(-1)).toMatchObject({ type, eyebrow: "Popüler rotalar" })
      await user.click(noteField())
      await user.paste("Yol seni çağırır")
      expect(changes.at(-1)).toMatchObject({ type, note: "Yol seni çağırır" })
    }
  )

  it("finds a note past its length and an unknown shop detail in the upper line", () => {
    const rail = newHomeSection("departures", "bolum00002")
    const problems = sectionProblems({
      ...rail,
      eyebrow: "{bilinmeyen}",
      note: "x".repeat(61),
    } as AnySection)
    expect(problems["eyebrow"]).toBeTruthy()
    expect(problems["note"]).toBeTruthy()
    expect(sectionProblems(rail)["note"]).toBeUndefined()
  })

  it("keeps the posts' upper line when the panel turns into the tiles", () => {
    const panel = switchVariant(
      newHomeSection("posts", "bolum00003") as PostsSection,
      "intro_panel"
    )
    const tiles = switchVariant({ ...panel, eyebrow: "Blog" }, "grid")
    expect(tiles).toMatchObject({ variant: "grid", eyebrow: "Blog" })
    // The posts' line keeps its 40 characters
    expect(sectionProblems({ ...tiles, eyebrow: "x".repeat(41) })["eyebrow"]).toBeTruthy()
  })
})
