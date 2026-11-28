import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PresetCard as Preset } from "./api"
import { presetFamilies } from "./families"
import { preset } from "./gallery.fixtures"
import { PresetCard } from "./preset-card"

const TEZGAH = [
  preset("tezgah", {
    family: "tezgah",
    swatch: "Lacivert ve çelik",
    name: "Tezgâh",
    description: "Lacivert zemin",
    live: 1,
  }),
  preset("tezgah-gece", {
    family: "tezgah",
    swatch: "Gece",
    name: "Tezgâh · Gece",
    description: "Koyu zemin",
    tone: "dark",
    version: 2,
    in_draft: 1,
  }),
]

function card(members: Preset[], busy = false) {
  const [family] = presetFamilies(members)
  if (!family) {
    throw new Error("no family")
  }
  const onApply = vi.fn()
  const onPreview = vi.fn()
  render(<PresetCard family={family} busy={busy} onApply={onApply} onPreview={onPreview} />)
  return { onApply, onPreview, article: screen.getByRole("article", { name: "Tezgâh" }) }
}

describe("PresetCard", () => {
  it("opens on the colour set in the draft and says it has a newer version", () => {
    const { article } = card(TEZGAH)

    expect(within(article).getByRole("radio", { name: "Gece" })).toBeChecked()
    expect(within(article).getByText("Koyu zemin")).toBeVisible()
    expect(within(article).getByText("Taslakta")).toBeVisible()
    expect(within(article).getByText("Yeni sürüm var")).toBeVisible()
    expect(within(article).queryByText("Yayında")).toBeNull()
  })

  it("changes the card to the colour set picked, by click or arrow key, and applies that one", async () => {
    const user = userEvent.setup()
    const { article, onApply, onPreview } = card(TEZGAH)

    await user.click(within(article).getByRole("radio", { name: "Lacivert ve çelik" }))
    expect(within(article).getByText("Lacivert zemin")).toBeVisible()
    // One state: its tone shows in its picture, not in a badge
    expect(within(article).queryByText("Açık")).toBeNull()
    expect(within(article).getByText("Yayında")).toBeVisible()
    expect(within(article).queryByText("Yeni sürüm var")).toBeNull()

    await user.click(
      within(article).getByRole("button", {
        name: "‘Tezgâh · Lacivert ve çelik’ görünümünü taslağa uygula",
      })
    )
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ code: "tezgah" }))

    await user.click(within(article).getByRole("radio", { name: "Lacivert ve çelik" }))
    // Radix moves focus a tick later and checks the radio it lands on while the key is down
    await user.keyboard("{ArrowRight>}")
    await waitFor(() => {
      expect(within(article).getByRole("radio", { name: "Gece" })).toBeChecked()
    })
    await user.keyboard("{/ArrowRight}")
    await user.click(
      within(article).getByRole("button", { name: "‘Tezgâh · Gece’ görünümünü önizle" })
    )
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ code: "tezgah-gece" }))
  })

  it("draws a look of its own without a colour choice, and holds apply while another runs", () => {
    render(
      <PresetCard
        family={{ key: "general/sade", name: "Sade", members: [preset("sade")] }}
        busy
        onApply={vi.fn()}
        onPreview={vi.fn()}
      />
    )

    expect(screen.queryByRole("radiogroup")).toBeNull()
    expect(screen.getByRole("button", { name: "‘Sade’ görünümünü taslağa uygula" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "‘Sade’ görünümünü önizle" })).toBeEnabled()
  })
})
