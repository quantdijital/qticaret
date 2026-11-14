import { screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import {
  SETTINGS,
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

const CONTRAST = /beyaz yazıyla ya da sayfa zemininde yeterince okunmuyor/
const WELL = /bir ton koyusu olan alanlarda/

// Each test types and picks through the whole editor, which draws itself anew
// on every key: CPU work a full run's load can stretch past the default 5 s.
// Nothing waits on the wall clock (holdClock), so this bounds work, not waiting
const HEAVY = { timeout: 15_000 }

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

/** The theme the last draft save sent. */
const savedTheme = () => lastSaved(fetchMock)?.settings.theme

describe("the theme settings in the draft (adr/0063 §3)", HEAVY, () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => {
    releaseClock()
  })

  it("saves every choice into the draft as it is made, the preview reloading, nothing live", async () => {
    const primary = await openTheme()
    const preview = await screen.findByTitle("Vitrin önizlemesi")
    expect(preview).toHaveAttribute("src", expect.stringContaining("/onizleme/sfl_1"))
    expect(screen.getByText(/taslağın parçasıdır/)).toBeVisible()
    expect(screen.queryByRole("button", { name: "Kaydet ve yayınla" })).toBeNull()

    await user.type(primary, "#0B5C99")
    await user.click(screen.getByRole("combobox", { name: "Başlıklar" }))
    await user.click(await screen.findByRole("option", { name: /Playfair Display/ }))
    await user.click(screen.getByRole("radio", { name: "Nötr" }))
    await user.click(screen.getByRole("switch", { name: /^Puanı göster/ }))
    await pass(AUTOSAVE_MS)

    await waitFor(() => {
      expect(savedTheme()).toEqual({
        ...THEME,
        colors: { primary: "#0b5c99", accent: null, background: "neutral" },
        typography: { heading: "playfair", body: "manrope" },
        product_card: { ratio: "1:1", show_brand: true, show_rating: true },
      })
    })
    // Neither the theme section nor the storefront section is written: "Yayınla" puts it live
    expect(postsTo(fetchMock, THEME_SETTINGS)).toEqual([])
    expect(postsTo(fetchMock, SETTINGS)).toEqual([])
    await waitFor(() => {
      expect(screen.getByTitle("Vitrin önizlemesi")).toHaveAttribute(
        "src",
        expect.stringContaining("/onizleme/sfl_2")
      )
    })
    expect(screen.getByRole("button", { name: "Yayınla" })).toBeEnabled()
  })

  it("holds the draft while the main colour does not read on the page, or newly in its well", async () => {
    const primary = await openTheme()
    await pass(AUTOSAVE_MS)
    const before = postsTo(fetchMock).length

    // Over 3:1 on white and on Grafit's steel page, not on its well (adr/0062 §6)
    await user.type(primary, "#2f8dff")
    expect(await screen.findByRole("alert")).toHaveTextContent(WELL)
    expect(primary).toHaveAttribute("aria-invalid", "true")
    // Not on the warm page at all
    await user.click(screen.getByRole("radio", { name: "Sıcak" }))
    expect(screen.getByRole("alert")).toHaveTextContent(CONTRAST)
    expect(screen.getByRole("alert")).not.toHaveTextContent(WELL)
    // The row in the tree says where the problem is
    expect(
      within(screen.getByRole("navigation", { name: "Sayfanın bölümleri" })).getByRole("button", {
        name: /Tema ayarları/,
      })
    ).toBeInTheDocument()
    await pass(AUTOSAVE_MS)
    expect(postsTo(fetchMock)).toHaveLength(before)
    expect(screen.getByRole("status", { name: "Taslağın durumu" })).toHaveTextContent(/düzelt/i)

    await user.clear(primary)
    await user.type(primary, "#2a7ff0")
    expect(screen.queryByRole("alert")).toBeNull()
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(savedTheme()?.colors).toEqual({ primary: "#2a7ff0", accent: null, background: "warm" })
    })
  })

  it("keeps saving a colour stored before the well rule until it is changed", async () => {
    // Stored in the draft already: the server lets it be, so does the editor
    const primary = await openTheme({ theme: { colors: { ...THEME.colors, primary: "#2f8dff" } } })
    expect(primary).toHaveValue("#2f8dff")
    expect(screen.queryByRole("alert")).toBeNull()
    await choose("Köşeler", "Keskin")
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(savedTheme()).toMatchObject({ radius: "sharp", colors: { primary: "#2f8dff" } })
    })
    // Another page colour is a change: judged in the new page's well
    await user.click(screen.getByRole("radio", { name: "Soğuk" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(WELL)
  })

  it("says why the server refused a colour, in the shop's words", async () => {
    const refusal =
      "Bu renk beyaz yazıyla ya da sayfa zemininde yeterince okunmuyor (en az 3:1 karşıtlık gerekir). Daha koyu bir ton seçin."
    let refuse = false
    serve(fetchMock, admin, layoutOf(), { refuse: () => (refuse ? refusal : null) })
    renderEditor()
    const tree = await opened()
    await user.click(within(tree).getByRole("button", { name: "Tema ayarları" }))
    await pass(AUTOSAVE_MS)
    refuse = true
    await choose("Köşeler", "Keskin")
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(screen.getByRole("status", { name: "Taslağın durumu" })).toHaveTextContent(
        `Kaydedilemedi: ${refusal}`
      )
    })
  })

  it("takes a change back with the editor's undo, as any change to the design", async () => {
    await openTheme()
    await user.click(screen.getByRole("combobox", { name: "Köşeler" }))
    await user.click(await screen.findByRole("option", { name: "Keskin" }))
    expect(screen.getByRole("combobox", { name: "Köşeler" })).toHaveTextContent("Keskin")

    await user.click(screen.getByRole("button", { name: "Geri al" }))
    expect(screen.getByRole("combobox", { name: "Köşeler" })).not.toHaveTextContent("Keskin")
  })

  it("puts a colour back to the theme's own as none", async () => {
    const primary = await openTheme({ theme: { colors: { ...THEME.colors, accent: "#c2410c" } } })
    const accent = screen.getByRole("textbox", { name: "Vurgu rengi" })
    expect(primary).toHaveValue("")
    expect(primary).toHaveAttribute("placeholder", "Temanın rengi")
    expect(accent).toHaveValue("#c2410c")

    await user.click(screen.getByRole("button", { name: "Varsayılan" }))
    expect(accent).toHaveValue("")
    await pass(AUTOSAVE_MS)

    await waitFor(() => {
      expect(savedTheme()?.colors).toMatchObject({ primary: null, accent: null })
    })
  })
})
