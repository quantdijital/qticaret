import { act, screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import { ATOLYE_COLORS } from "@/theme/atolye"
import {
  THEME,
  THEME_SETTINGS,
  holdClock,
  lastSaved,
  layoutOf,
  opened,
  pass,
  postsTo,
  releaseClock,
  renderEditor,
  serve,
} from "./theme-editor.fixtures"
import type { AdminMock, Init, ServeOptions } from "./theme-editor.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const admin = vi.hoisted<AdminMock>(() => ({
  productCategory: { list: vi.fn() },
  product: { list: vi.fn() },
  productCollection: { list: vi.fn() },
}))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useRouter: () => ({ history: { back: vi.fn() } }),
  useCanGoBack: () => true,
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
}))

// The whole editor draws itself anew on every key: see theme-panel.spec.tsx
const HEAVY = { timeout: 15_000 }

const grafit = () => screen.getByRole("button", { name: "Grafit'e dön" })
/** The theme the last draft save sent. */
const savedTheme = () => lastSaved(fetchMock)?.settings.theme

/** A part of the sample by its name (`data-sample`). */
function part(name: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-sample="${name}"]`)
  if (!found) {
    throw new Error(`the sample has no ${name}`)
  }
  return found
}

let user: UserEvent

/** The editor with the theme's settings open. */
async function openTheme(options: ServeOptions = {}) {
  serve(fetchMock, admin, layoutOf(), options)
  renderEditor()
  const tree = await opened()
  await user.click(within(tree).getByRole("button", { name: "Tema ayarları" }))
  return screen.findByRole("textbox", { name: "Ana renk" })
}

async function choose(field: string, option: RegExp | string) {
  await user.click(screen.getByRole("combobox", { name: field }))
  await user.click(await screen.findByRole("option", { name: option }))
}

describe("the theme settings show what the theme draws (adr/0062 §12)", HEAVY, () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => {
    releaseClock()
  })

  it("samples Grafit as stored, then each choice as it is made, before any save", async () => {
    const primary = await openTheme()
    // Nothing chosen: the theme's wine on a pill, the announcement on graphite
    expect(part("button")).toHaveStyle({
      backgroundColor: ATOLYE_COLORS.wine,
      borderRadius: "999px",
    })
    expect(part("link")).toHaveStyle({ color: ATOLYE_COLORS.wine })
    expect(part("bar")).toHaveStyle({ backgroundColor: ATOLYE_COLORS.stage })
    expect(part("page")).toHaveStyle({ backgroundColor: "#f8fafc" })
    expect(part("chip-selected")).toHaveStyle({ backgroundColor: ATOLYE_COLORS.text })
    expect(part("box")).toHaveStyle({ borderRadius: "20px" })
    expect(part("picture")).toHaveStyle({ borderRadius: "14px" })
    expect(document.querySelector('[data-sample="brand"]')).not.toBeNull()
    expect(document.querySelector('[data-sample="rating"]')).toBeNull()
    expect(part("notes")).toHaveTextContent("Başlık: Manrope. Metin: Manrope.")
    expect(part("notes")).toHaveTextContent(/Panelde yüklü olmayan yazı tipi: Manrope\./)
    expect(part("notes")).toHaveTextContent(/temanın şarap tonudur/)

    await user.type(primary, "#0b5c99")
    await user.type(screen.getByRole("textbox", { name: "Vurgu rengi" }), "#c2410c")
    await user.click(screen.getByRole("radio", { name: "Sıcak" }))
    await choose("Düğmeler", "Köşeli")
    await choose("Köşeler", "Yuvarlak")
    await choose("Başlıklar", /Inter/)
    await user.click(screen.getByRole("switch", { name: /^Puanı göster/ }))
    await user.click(screen.getByRole("switch", { name: /^Markayı göster/ }))

    expect(part("button")).toHaveStyle({ backgroundColor: "#0b5c99", borderRadius: "0px" })
    expect(part("field")).toHaveStyle({ borderRadius: "0px" })
    expect(part("link")).toHaveStyle({ color: "#0b5c99" })
    // The announcement bar takes neither colour; chips stay pills
    expect(part("bar")).toHaveStyle({ backgroundColor: ATOLYE_COLORS.stage })
    expect(part("chip-selected")).toHaveStyle({
      backgroundColor: "#c2410c",
      borderRadius: "999px",
    })
    expect(part("chip")).toHaveStyle({ borderRadius: "999px" })
    expect(part("page")).toHaveStyle({ backgroundColor: "#f6f4ef" })
    expect(part("box")).toHaveStyle({ borderRadius: "30px" })
    expect(part("picture")).toHaveStyle({ borderRadius: "21px" })
    expect(part("heading").style.fontFamily).toMatch(/^"Inter Variable"/)
    expect(part("heading")).toHaveStyle({ fontWeight: "800" })
    expect(document.querySelector('[data-sample="brand"]')).toBeNull()
    expect(document.querySelector('[data-sample="rating"]')).not.toBeNull()
    expect(part("notes")).toHaveTextContent("Başlık: Inter. Metin: Manrope.")
    expect(part("notes")).not.toHaveTextContent(/şarap tonudur/)
    // Nothing was saved for any of it
    expect(postsTo(fetchMock, THEME_SETTINGS)).toEqual([])
  })

  it("says what each setting changes, and warns under a heading face without ₺ or with one weight", async () => {
    await openTheme()
    expect(screen.getByText(/Duyuru şeridi bu rengi almaz, grafit kalır/)).toBeVisible()
    expect(screen.getByText(/Seçili çip ve sekme, sayı rozetleri/)).toBeVisible()
    expect(screen.getByText(/Koyu grafit bölümler/)).toBeVisible()
    expect(screen.getByText(/Grafit'in 20 \/ 14 \/ 10 px köşeleridir/)).toBeVisible()
    expect(screen.getByText(/arama alanı, form alanları ve adet seçici/)).toBeVisible()
    expect(screen.getByText(/Onaylı değerlendirmesi olan ürünlerin kartında/)).toBeVisible()
    expect(screen.queryByText(/₺ işareti yok/)).toBeNull()
    expect(screen.queryByText(/Tek kalınlığı vardır/)).toBeNull()

    await choose("Başlıklar", /Playfair Display/)
    expect(screen.getByText(/₺ işareti yok\. Fiyatlar metin yazı tipiyle çizilir/)).toBeVisible()
    expect(screen.queryByText(/Tek kalınlığı vardır/)).toBeNull()

    await choose("Başlıklar", /DM Serif Display/)
    expect(screen.getByText(/₺ işareti yok.*Tek kalınlığı vardır/)).toBeVisible()
    expect(part("heading")).toHaveStyle({ fontWeight: "400" })

    await choose("Başlıklar", /Fraunces/)
    expect(screen.queryByText(/₺ işareti yok/)).toBeNull()
  })

  it("leaves the header's layout and stickiness to the header bar (adr/0049 Ek 2026-11-14 §5)", async () => {
    await openTheme({ theme: { header: { layout: "centered", sticky: true } } })
    expect(screen.getByRole("combobox", { name: "Köşeler" })).toBeVisible()
    expect(screen.queryByRole("combobox", { name: "Logo yerleşimi" })).toBeNull()
    expect(screen.queryByRole("switch", { name: "Üst bilgi sabit kalsın" })).toBeNull()
  })

  it("offers the section spacing beside the shapes, its term small, into the draft (K-11)", async () => {
    await openTheme()
    const spacing = screen.getByRole("combobox", { name: "Bölüm aralığı" })
    expect(spacing).toHaveTextContent("Normal")
    expect(screen.getByText("section spacing").tagName).toBe("SMALL")
    await choose("Bölüm aralığı", "Sık")
    expect(grafit()).toBeEnabled()
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(savedTheme()).toMatchObject({ section_spacing: "compact" })
    })
  })

  it("puts Grafit into the draft at once from a saved look, one toast's undo away", async () => {
    await openTheme({
      theme: {
        colors: { primary: "#0b5c99", accent: "#c2410c", background: "warm" },
        typography: { heading: "fraunces", body: "inter" },
        radius: "sharp",
        buttons: "square",
        product_card: {
          ...GRAFIT_THEME.product_card,
          ratio: "4:5",
          show_brand: false,
          show_rating: true,
        },
        header: { layout: "left", sticky: false },
      },
    })
    expect(grafit()).toHaveAccessibleDescription(/Değişiklik taslağa yazılır/)
    await user.click(grafit())

    // No question: the draft keeps its history, the toast takes it back
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(screen.getByRole("textbox", { name: "Ana renk" })).toHaveValue("")
    expect(screen.getByRole("textbox", { name: "Vurgu rengi" })).toHaveValue("")
    expect(screen.getByRole("radio", { name: "Çelik beyazı (Grafit)" })).toBeChecked()
    expect(screen.getByRole("combobox", { name: "Köşeler" })).toHaveTextContent("Yumuşak")
    expect(part("button")).toHaveStyle({ backgroundColor: ATOLYE_COLORS.wine })
    expect(grafit()).toBeDisabled()
    const [said, extra] = vi.mocked(toast.success).mock.calls.at(-1) ?? []
    expect(said).toBe("Tema ayarları Grafit'e döndü.")
    const action = extra?.action as { label: string; onClick: () => void } | undefined
    expect(action?.label).toBe("Geri al")
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(savedTheme()).toEqual({ ...THEME, ...GRAFIT_THEME })
    })
    // The theme section is never written: "Yayınla" puts the draft live
    expect(postsTo(fetchMock, THEME_SETTINGS)).toEqual([])

    act(() => {
      action?.onClick()
    })
    expect(screen.getByRole("textbox", { name: "Ana renk" })).toHaveValue("#0b5c99")
    expect(screen.getByRole("combobox", { name: "Köşeler" })).toHaveTextContent("Keskin")
    expect(screen.getByRole("radio", { name: "Sıcak" })).toBeChecked()
  })

  it("has nothing to do on Grafit itself, and one undo takes Grafit back over unsaved changes", async () => {
    const primary = await openTheme()
    expect(THEME).toMatchObject(GRAFIT_THEME)
    expect(grafit()).toBeDisabled()

    await user.type(primary, "#0b5c99")
    await choose("Köşeler", "Keskin")
    await user.click(grafit())
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(primary).toHaveValue("")
    expect(screen.getByRole("combobox", { name: "Köşeler" })).toHaveTextContent("Yumuşak")

    // The editor's own undo, as for any change to the design
    await user.click(screen.getByRole("button", { name: "Geri al" }))
    expect(primary).toHaveValue("#0b5c99")
    expect(screen.getByRole("combobox", { name: "Köşeler" })).toHaveTextContent("Keskin")
  })
})
