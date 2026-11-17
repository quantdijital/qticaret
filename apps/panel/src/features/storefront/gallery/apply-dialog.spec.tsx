import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { LAYOUT_KEY } from "@/features/storefront/api/layout"
import { layoutOf } from "@/features/storefront/editor/theme-editor.fixtures"
import { REPORT_KEY } from "./api"
import type { ApplyTarget } from "./api"
import { ApplyDialog } from "./apply-dialog"
import { design, preset } from "./gallery.fixtures"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: toastError } }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))

const KEPT = { id: "sfd_kept", kind: "saved", name: "Eski vitrin" } as const

interface Options {
  draftChanged?: boolean
  pendingMenus?: boolean
  savedFull?: boolean
}

function open(target: ApplyTarget, options: Options = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <ApplyDialog
        target={target}
        onClose={onClose}
        draftChanged={options.draftChanged ?? false}
        pendingMenus={options.pendingMenus ?? false}
        savedFull={options.savedFull ?? false}
        savedLimit={10}
        currentName="Grafit"
      />
    </QueryClientProvider>
  )
  return { client, onClose }
}

const grafit = (more: Parameters<typeof preset>[1] = {}): ApplyTarget => ({
  kind: "preset",
  preset: preset("grafit", more),
})
const lines = () =>
  within(screen.getByRole("dialog"))
    .getAllByRole("listitem")
    .map((each) => each.textContent)

describe("ApplyDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    toastError.mockReset()
  })

  it("says what a ready-made look with menus, header and footer changes", () => {
    open(grafit({ has_menus: true }))

    expect(screen.getByRole("dialog", { name: "‘Grafit’ taslağa uygulansın mı?" })).toBeVisible()
    expect(
      screen.getByText(
        "Bu görünüm menü de içerir. Yayınla'ya bastığınızda mağazanın menüleri bu görünümün menüleriyle değişir."
      )
    ).toBeVisible()
    expect(lines()).toEqual([
      "Vitrin hemen değişmez. Görünüm taslağa uygulanır; siz Yayınla'ya basana kadar ziyaretçiler bugünkü görünümü görür.",
      "Şimdiki görünümünüzde değişiklik yaptıysanız 'Kayıtlı görünümlerim'e otomatik kaydedilir.",
      "Üst ve alt bilgi bu görünümünküyle değişir.",
      "Güven rozetleri, renk örnekleri ve 'Az kaldı' ayarınız korunur.",
    ])
  })

  it("keeps the shop's menus and its footer where the look brings none", () => {
    open(grafit({ has_footer: false }), { draftChanged: true, pendingMenus: true })

    expect(screen.queryByText(/Bu görünüm menü de içerir/)).toBeNull()
    expect(lines()).toEqual([
      expect.stringMatching(/^Vitrin hemen değişmez/),
      "Taslaktaki yayınlanmamış değişiklikler bu görünümle değiştirilecek. Kaybolmazlar: şimdiki taslak 'Kayıtlı görünümlerim'e otomatik kaydedilir.",
      "Üst bilgi bu görünümünküyle değişir.",
      "Alt bilginiz korunur.",
      "Menülerinize dokunulmaz.",
      "Taslakta yayınlanmayı bekleyen menü değişikliği var; kayda alınmaz.",
      expect.stringMatching(/^Güven rozetleri/),
    ])
  })

  it("tells a saved look never carries menus", () => {
    open({ kind: "design", design: design("sfd_1"), name: "Bayram vitrini" })

    expect(
      screen.getByRole("dialog", { name: "‘Bayram vitrini’ taslağa uygulansın mı?" })
    ).toBeVisible()
    expect(lines()).toContain("Menülerinize dokunulmaz; kayıtlı görünümler menü taşımaz.")
    expect(lines().some((line) => line.includes("bilgi"))).toBe(false)
  })

  it("applies, keeps the draft by the name typed, and opens the editor with a note of it", async () => {
    const layout = layoutOf()
    fetchMock.mockResolvedValue({
      layout,
      result: { auto_saved: KEPT, skipped: [], kept: ["footer"] },
    })
    const user = userEvent.setup()
    const { client, onClose } = open(grafit())

    await user.click(screen.getByRole("checkbox", { name: "Şimdiki görünümü adıyla da kaydet" }))
    const field = screen.getByRole<HTMLInputElement>("textbox", { name: "Ad" })
    expect(field.value).toMatch(/^Grafit, \d{1,2} \S+$/)
    await user.clear(field)
    await user.type(field, "  Eski vitrin ")
    await user.click(screen.getByRole("button", { name: "Taslağa uygula ve düzenle" }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/storefront/editor" })
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/storefront-presets/general/grafit/apply", {
      method: "POST",
      body: { save_as: "Eski vitrin" },
    })
    expect(client.getQueryData(REPORT_KEY)).toEqual({
      name: "Grafit",
      auto_saved: KEPT,
      saved_name: "Eski vitrin",
      skipped: [],
      kept: ["footer"],
    })
    expect(client.getQueryData(LAYOUT_KEY)).toMatchObject({ revision: layout.revision })
    expect(onClose).toHaveBeenCalled()
  })

  it("keeps the draft automatically unless asked, and sends a saved look to its own address", async () => {
    fetchMock.mockResolvedValue({ layout: layoutOf(), result: { auto_saved: null, skipped: [] } })
    const user = userEvent.setup()
    const { client } = open({ kind: "design", design: design("sfd_1"), name: "Bayram vitrini" })

    expect(screen.queryByRole("textbox", { name: "Ad" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Taslağa uygula ve düzenle" }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalled()
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/storefront-designs/sfd_1/apply", {
      method: "POST",
      body: {},
    })
    expect(client.getQueryData(REPORT_KEY)).toMatchObject({ auto_saved: null, kept: [] })
  })

  it("closes the named save when the named looks are full, and says the automatic one still happens", () => {
    open(grafit(), { savedFull: true })

    const keep = screen.getByRole("checkbox", { name: "Şimdiki görünümü adıyla da kaydet" })
    expect(keep).toBeDisabled()
    expect(keep).toHaveAccessibleDescription(
      "Adlı kayıtlar dolu (10/10). Otomatik kayıt yine alınır."
    )
  })

  it("stays open and says why when the server refuses", async () => {
    fetchMock.mockRejectedValue(new Error("down"))
    const user = userEvent.setup()
    const { onClose } = open(grafit())

    await user.click(screen.getByRole("button", { name: "Taslağa uygula ve düzenle" }))
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled()
    })
    expect(navigate).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
