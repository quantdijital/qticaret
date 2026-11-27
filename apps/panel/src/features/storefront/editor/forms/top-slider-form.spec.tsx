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

  it("asks for a picture's words, and sets its height, transition and dots", async () => {
    const user = userEvent.setup()
    const changes = renderForm({ ...newTopSlider("kaydirici1"), slides: [slide(null)] })
    expect(screen.getByText(/Görseli anlatan kısa bir metin yazın/)).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "Yüksek" }))
    expect(changes.at(-1)).toMatchObject({ height: "tall" })
    await user.click(screen.getByRole("radio", { name: "Solarak" }))
    expect(changes.at(-1)).toMatchObject({ transition: "fade" })
    await user.click(screen.getByRole("switch", { name: /Noktaları göster/ }))
    expect(changes.at(-1)).toMatchObject({ dots: "on" })
    await user.click(screen.getByRole("button", { name: "1. görsel: kaldır" }))
    expect(changes.at(-1)).toMatchObject({ slides: [] })
  })
})
