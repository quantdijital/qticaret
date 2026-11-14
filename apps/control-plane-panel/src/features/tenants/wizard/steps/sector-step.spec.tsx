import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { refusal, stubApi } from "@/test/api"
import { renderAs } from "@/test/member"
import { SECTOR_PACKS } from "@/test/sector-packs"
import { filledDraft } from "@/test/wizard"
import type { ShopDraft } from "../draft"
import { SectorStep } from "./sector-step"

describe("SectorStep: the packs the control plane offers (C12)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("lists every pack with its version and contents, and takes the one chosen", async () => {
    const sent = stubApi((call) =>
      call.path === "/admin/cp/sector-packs"
        ? { status: 200, body: SECTOR_PACKS }
        : { status: 404, body: {} }
    )
    let draft: ShopDraft = filledDraft()
    const change = vi.fn((next: (current: ShopDraft) => ShopDraft) => {
      draft = next(draft)
    })
    renderAs(<SectorStep draft={draft} change={change} problems={{}} />, "operator")

    const general = await screen.findByRole("radio", { name: /^Genel/ })
    expect(general).toBeChecked()
    // No pack is "coming soon" any more: every one listed can be chosen
    expect(screen.queryByText("Yakında")).not.toBeInTheDocument()
    expect(screen.getByText("1 özellik şablonu · 5 özellik · 1 hazır görünüm")).toBeInTheDocument()
    expect(
      screen.getByText(
        "2 özellik şablonu · 31 özellik · 16 önerilen kategori · 2 ayar · 1 SEO şablonu"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Sürüm 2")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("radio", { name: /^Bıçak ve çatal-bıçak/ }))
    expect(draft.sector_pack).toBe("cutlery")
    expect(sent.filter((call) => call.path === "/admin/cp/sector-packs")).toHaveLength(1)
  })

  it("says why when the list cannot be read", async () => {
    stubApi(() => refusal(500, "errors.unexpected"))
    renderAs(<SectorStep draft={filledDraft()} change={vi.fn()} problems={{}} />, "operator")

    expect(await screen.findByRole("button", { name: /Tekrar dene|Yeniden dene/ })).toBeVisible()
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
  })
})
