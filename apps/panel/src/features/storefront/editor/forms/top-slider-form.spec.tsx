import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import type { TopSliderSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newTopSlider } from "@/features/storefront/layout/top-strip-kinds"
import { TopSliderForm } from "./top-slider-form"
import { SectionPanel } from "../section-panel"
import { openGroup, openTab } from "../settings-groups.fixtures"
import { sectionFields } from "./field-registry"
import type { AnySection } from "@/features/storefront/api/layout"
import type { ReactNode } from "react"
import { vi } from "vitest"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

/** The slider's whole panel as the editor holds it: every change kept. */
function renderPanel(section: AnySection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <SectionPanel
        section={value}
        group="header"
        problems={{}}
        canDuplicate={false}
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
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Holder />
    </QueryClientProvider>
  )
  return changes
}

function renderForm(section: TopSliderSection) {
  const changes: TopSliderSection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <TopSliderForm
        section={value}
        problems={sectionProblems(value)}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
      />
    )
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Holder />
    </QueryClientProvider>
  )
  return changes
}

const slide = (alt: string | null) => ({
  image: { url: "/static/kis.webp", alt },
  mobile_image: null,
  link: null,
})

/** The top image slider's form (owner 2026-11-27). */
describe("the top image slider's form", () => {
  it("says it draws nothing without pictures and offers to add one", () => {
    renderForm(newTopSlider("kaydirici1"))
    expect(screen.getByText(/Henüz görsel yok/)).toBeInTheDocument()
    expect(screen.getAllByText("Görsel ekle").length).toBeGreaterThan(0)
  })

  it("lists its slides as rows, one opened at a time, the words missing warned", async () => {
    const user = userEvent.setup()
    const changes = renderForm({
      ...newTopSlider("kaydirici1"),
      slides: [slide(null), slide("Yeni gelenler")],
    })
    const first = screen.getByRole("button", { name: /^1\. slayt(?!:)/ })
    const second = screen.getByRole("button", { name: /^2\. slayt(?!:)/ })
    expect(first).toHaveTextContent("Açıklama yok")
    expect(second).toHaveTextContent("Yeni gelenler")
    expect(first).toHaveAttribute("aria-expanded", "false")
    await user.click(first)
    expect(first).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText(/Görseli anlatan kısa bir metin yazın/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Örn\. Kış indirimi/)).toBeInTheDocument()
    await user.click(second)
    expect(first).toHaveAttribute("aria-expanded", "false")
    expect(second).toHaveAttribute("aria-expanded", "true")
    await user.click(screen.getByRole("button", { name: "2. slayt: kaldır" }))
    expect(changes.at(-1)?.slides).toHaveLength(1)
  })

  it("keeps its look in the Stil tab, grouped, as every section's", async () => {
    const user = userEvent.setup()
    const changes = renderPanel({ ...newTopSlider("kaydirici1"), slides: [slide("Kış")] })
    // İçerik holds the pictures alone
    expect(screen.queryByRole("radio", { name: "Yüksek" })).toBeNull()
    await openTab(user, "style")
    await openGroup(user, "Diziliş")
    await user.click(screen.getByRole("radio", { name: "Yüksek" }))
    expect(changes.at(-1)).toMatchObject({ height: "tall" })
    await openGroup(user, "Hareket")
    await user.click(screen.getByRole("radio", { name: "Solarak" }))
    expect(changes.at(-1)).toMatchObject({ transition: "fade" })
    await openGroup(user, "Ok ve nokta görünümü")
    await user.click(screen.getByRole("switch", { name: /Noktaları göster/ }))
    expect(changes.at(-1)).toMatchObject({ dots: "on" })
  })

  it("is found by the search in its Stil groups", () => {
    const fields = sectionFields(newTopSlider("kaydirici1"), "header")
    const groupOf = (key: string) => fields.find((field) => field.key === key)?.group
    expect(groupOf("top_slider.height")).toBe("layout")
    expect(groupOf("top_slider.transition")).toBe("motion")
    expect(groupOf("top_slider.dots")).toBe("controls")
  })
})
