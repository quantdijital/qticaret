import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { stubApi } from "@/test/api"
import { renderAs } from "@/test/member"
import { CUTLERY, GENERAL, SECTOR_PACKS } from "@/test/sector-packs"
import { filledDraft } from "@/test/wizard"
import type { ShopDraft } from "../draft"
import { LookStep } from "./look-step"

describe("LookStep: the chosen pack's ready-made looks (adr/0063 task 2.7)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const packs = () =>
    stubApi((call) =>
      call.path === "/admin/cp/sector-packs"
        ? { status: 200, body: SECTOR_PACKS }
        : { status: 404, body: {} }
    )

  it("shows each look with its picture, the pack's first chosen, and takes another", async () => {
    packs()
    let draft: ShopDraft = { ...filledDraft(), sector_pack: "cutlery", preset: "" }
    const change = vi.fn((next: (current: ShopDraft) => ShopDraft) => {
      draft = next(draft)
    })
    const { container } = renderAs(
      <LookStep draft={draft} change={change} problems={{}} />,
      "operator"
    )

    const first = await screen.findByRole("radio", { name: /^Katalog/ })
    expect(first).toBeChecked()
    expect(screen.getByText("Varsayılan")).toBeInTheDocument()
    // A look with a picture shows it from the control plane; one without, a plain frame
    const images = container.querySelectorAll("img")
    expect(images).toHaveLength(1)
    expect(images[0]?.getAttribute("src")).toBe(
      "/admin/cp/sector-packs/cutlery/presets/katalog/preview"
    )

    await userEvent.click(screen.getByRole("radio", { name: /^Tezgâh/ }))
    expect(draft.preset).toBe("tezgah")
  })

  it("offers the sample products only for a pack that has them, off by default", async () => {
    const withSamples = { ...CUTLERY, sample_products: 12 }
    stubApi((call) =>
      call.path === "/admin/cp/sector-packs"
        ? { status: 200, body: { sector_packs: [GENERAL, withSamples] } }
        : { status: 404, body: {} }
    )
    let draft: ShopDraft = { ...filledDraft(), sector_pack: "cutlery" }
    const change = vi.fn((next: (current: ShopDraft) => ShopDraft) => {
      draft = next(draft)
    })
    const view = renderAs(<LookStep draft={draft} change={change} problems={{}} />, "operator")

    const box = await screen.findByRole("checkbox", { name: "Örnek ürünlerle başla" })
    expect(box).not.toBeChecked()
    expect(screen.getByText(/12 örnek ürünü/)).toBeInTheDocument()
    await userEvent.click(box)
    expect(draft.sample_catalog).toBe(true)

    // The general pack has none: nothing offered
    view.unmount()
    renderAs(
      <LookStep
        draft={{ ...filledDraft(), sector_pack: "general" }}
        change={vi.fn()}
        problems={{}}
      />,
      "operator"
    )
    expect(await screen.findByText(/hazır görünümü yok/)).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("says the pack has no looks", async () => {
    packs()
    renderAs(
      <LookStep
        draft={{ ...filledDraft(), sector_pack: "general" }}
        change={vi.fn()}
        problems={{}}
      />,
      "operator"
    )
    expect(await screen.findByText(/hazır görünümü yok/)).toBeInTheDocument()
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
  })
})
