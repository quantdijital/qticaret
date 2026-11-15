import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { HeroSliderSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { HeroSliderForm } from "./hero-slider-form"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const slide = (name: string, heading: string | null) => ({
  image: { url: `/static/${name}.webp`, alt: null },
  mobile_image: null,
  heading,
  text: null,
  link: null,
  position: "left" as const,
  tone: "light" as const,
})

const start = (): HeroSliderSection => ({
  ...(newHomeSection("hero_slider", "kayangiris") as HeroSliderSection),
  slides: [slide("bir", "Atölyeden yeni gelenler"), slide("iki", null)],
})

/** The form as the editor holds it: every change kept, its problems found again. */
function renderForm(section: HeroSliderSection = start()) {
  const changes: HeroSliderSection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <HeroSliderForm
        section={value}
        problems={sectionProblems(value)}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Holder />
    </QueryClientProvider>
  )
  return { last: () => changes.at(-1) }
}

describe("the hero slider's form (adr/0049 Ek 2026-11-06)", () => {
  it("is still by default; its seconds show once autoplay is on", async () => {
    const user = userEvent.setup()
    const form = renderForm()
    expect(screen.getByRole("switch", { name: /Otomatik geçiş/ })).not.toBeChecked()
    expect(screen.queryByRole("spinbutton", { name: "Her slayt kaç saniye" })).toBeNull()
    expect(screen.getByRole("switch", { name: /Noktaları göster/ })).toBeChecked()
    expect(screen.getByRole("switch", { name: /Okları göster/ })).toBeChecked()

    await user.click(screen.getByRole("switch", { name: /Otomatik geçiş/ }))
    expect(screen.getByRole("spinbutton", { name: "Her slayt kaç saniye" })).toHaveValue(6)
    await user.click(screen.getByRole("radio", { name: "Kısa" }))
    expect(form.last()).toMatchObject({ autoplay: true, interval: 6, height: "compact" })
  })

  it("lists the slides as rows with their heading, moves and removes them", async () => {
    const user = userEvent.setup()
    const form = renderForm()
    const rows = within(screen.getByRole("list", { name: "Slaytlar" })).getAllByRole("listitem")
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent("Atölyeden yeni gelenler")
    expect(rows[1]).toHaveTextContent("Başlık yok")

    await user.click(screen.getByRole("button", { name: /2\. slayt.*yukarı/i }))
    expect(form.last()?.slides.map((each) => each.heading)).toEqual([
      null,
      "Atölyeden yeni gelenler",
    ])
    // One slide is not a slider: the save waits, the reason in sight
    await user.click(screen.getByRole("button", { name: /1\. slayt.*kaldır/i }))
    expect(screen.getByRole("alert")).toHaveTextContent("En az iki slayt ekleyin.")
  })

  it("edits one slide in a dialog, steps to the next asking first, and saves it into the draft", async () => {
    const user = userEvent.setup()
    const form = renderForm()
    await user.click(screen.getByRole("button", { name: "1. slayt: düzenle" }))
    const dialog = await screen.findByRole("dialog", { name: "Slaydı düzenle" })
    expect(within(dialog).getByText("1 / 2")).toBeVisible()
    expect(within(dialog).getByRole("button", { name: "Kaydet" })).toBeDisabled()

    const heading = within(dialog).getByRole("textbox", { name: "Başlık" })
    await user.clear(heading)
    await user.type(heading, "Elde bilenmiş")
    // Unsaved: stepping on asks before throwing the change away
    await user.click(within(dialog).getByRole("button", { name: "Sonraki slayt" }))
    const ask = await screen.findByRole("alertdialog")
    await user.click(within(ask).getByRole("button", { name: /Vazgeç|İptal/ }))

    await user.click(within(dialog).getByRole("radio", { name: "Sağda" }))
    await user.click(within(dialog).getByRole("radio", { name: "Koyu yazı, açık görsel" }))
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    expect(screen.queryByRole("dialog", { name: "Slaydı düzenle" })).toBeNull()
    expect(form.last()?.slides[0]).toMatchObject({
      heading: "Elde bilenmiş",
      position: "right",
      tone: "dark",
    })
    expect(form.last()?.slides[1]).toMatchObject({ heading: null, position: "left" })
  })

  it("steps between slides with the dialog's arrows when nothing is unsaved", async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole("button", { name: "1. slayt: düzenle" }))
    const dialog = await screen.findByRole("dialog", { name: "Slaydı düzenle" })
    expect(within(dialog).getByRole("button", { name: "Önceki slayt" })).toBeDisabled()
    await user.click(within(dialog).getByRole("button", { name: "Sonraki slayt" }))
    expect(within(dialog).getByText("2 / 2")).toBeVisible()
    expect(within(dialog).getByRole("textbox", { name: "Başlık" })).toHaveValue("")
    expect(within(dialog).getByRole("button", { name: "Sonraki slayt" })).toBeDisabled()
  })
})
