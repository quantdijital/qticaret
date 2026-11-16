import { screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import {
  PATH,
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
import { openGroups } from "./settings-groups.fixtures"

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

/** The theme's settings open from the tree, no group open yet (they come closed). */
async function toTheme() {
  const tree = await opened()
  await user.click(within(tree).getByRole("button", { name: "Tema ayarları" }))
  await screen.findByRole("searchbox", { name: "Tema ayarlarında ara" })
}

/** The editor with the theme's settings open, "Renkler" and the `groups` named opened. */
async function openTheme(options: ServeOptions = {}, ...groups: string[]) {
  serve(fetchMock, admin, layoutOf(), options)
  renderEditor()
  await toTheme()
  await openGroups(user, "Renkler", ...groups)
  return screen.getByRole("textbox", { name: "Ana renk" })
}

async function choose(field: RegExp | string, option: RegExp | string) {
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

  it("comes with its groups closed, no tabs, and opens one to its fields", async () => {
    serve(fetchMock, admin, layoutOf())
    renderEditor()
    await toTheme()
    expect(screen.queryByRole("tab")).toBeNull()
    for (const title of [
      "Renkler",
      "Yazı tipleri",
      "Şekiller",
      "Boşluklar",
      "Yüzeyler",
      "Ürün kartı",
    ]) {
      expect(screen.getByRole("button", { name: title })).toHaveAttribute("aria-expanded", "false")
    }
    expect(screen.queryByRole("textbox", { name: "Ana renk" })).toBeNull()
    await openGroups(user, "Renkler")
    expect(screen.getByRole("textbox", { name: "Ana renk" })).toBeVisible()
  })

  it("saves the card style and the framed card's switches into the draft (adr/0049 Ek 2026-11-14 §3.3)", async () => {
    await openTheme({}, "Ürün kartı", "Çerçeveli kart")
    await choose("Kart biçimi", "Çerçeveli")
    await user.click(screen.getByRole("switch", { name: /^Üstüne gelince ikinci fotoğraf/ }))
    await user.click(screen.getByRole("switch", { name: /^İndirim etiketini göster/ }))
    await choose(/^Tükenmiş üründe fiyat satırı/, "“Gelince haber ver” bağlantısı")
    await choose(/^Düğme stili/, "Yazı")
    await pass(AUTOSAVE_MS)

    await waitFor(() => {
      expect(savedTheme()?.product_card).toEqual({
        ...THEME.product_card,
        variant: "framed",
        hover_image: false,
        sale_badge: false,
        sold_out_row: "notify",
        button_style: "text",
      })
    })
  })

  it("shows the quick view's look and contents only once it is on, and saves them (adr/0049 Ek 2026-11-15)", async () => {
    await openTheme({}, "Ürün kartı")
    const off = screen.getByRole("switch", { name: /^Hızlı bakışı göster/ })
    expect(off.getAttribute("aria-checked")).toBe("false")
    expect(screen.queryByRole("combobox", { name: /^Düğmenin görünüşü/ })).toBeNull()
    expect(screen.queryByRole("switch", { name: /^Pencerede adet seçiciyi göster/ })).toBeNull()

    await user.click(off)
    await choose(/^Düğmenin görünüşü/, "Her zaman simge")
    await user.click(screen.getByRole("switch", { name: /^Pencerede adet seçiciyi göster/ }))
    expect(screen.getByRole("switch", { name: /^Pencerede puanı göster/ })).toBeTruthy()
    expect(screen.getByRole("switch", { name: /^Pencerede kısa açıklamayı göster/ })).toBeTruthy()
    await pass(AUTOSAVE_MS)

    await waitFor(() => {
      expect(savedTheme()?.product_card).toEqual({
        ...THEME.product_card,
        quick_view: true,
        quick_view_trigger: "icon",
        quick_view_quantity: false,
      })
    })
  })

  it("saves every choice into the draft as it is made, the preview reloading, nothing live", async () => {
    const primary = await openTheme({}, "Yazı tipleri", "Ürün kartı")
    const preview = await screen.findByTitle("Vitrin önizlemesi")
    expect(preview).toHaveAttribute("src", expect.stringContaining("/onizleme/sfl_1"))
    expect(screen.getByText(/taslağın parçasıdır/)).toBeVisible()
    expect(screen.queryByRole("button", { name: "Kaydet ve yayınla" })).toBeNull()

    // Typing waits for a pause; a choice picked is saved at once, with what was typed (adr/0065 §5)
    await user.type(primary, "#0B5C99")
    expect(postsTo(fetchMock)).toEqual([])
    await user.click(screen.getByRole("combobox", { name: "Başlıklar" }))
    await user.click(await screen.findByRole("option", { name: /Playfair Display/ }))
    await pass(0)
    await waitFor(() => {
      expect(savedTheme()?.typography.heading).toBe("playfair")
    })
    expect(savedTheme()?.colors.primary).toBe("#0b5c99")
    await user.click(screen.getByRole("radio", { name: "Nötr" }))
    await user.click(screen.getByRole("switch", { name: /^Puanı göster/ }))
    await pass(0)

    await waitFor(() => {
      expect(savedTheme()).toEqual({
        ...THEME,
        colors: { primary: "#0b5c99", accent: null, background: "neutral" },
        typography: { heading: "playfair", body: "manrope" },
        product_card: { ...THEME.product_card, ratio: "1:1", show_brand: true, show_rating: true },
      })
    })
    // Neither the theme section nor the storefront section is written: "Yayınla" puts it live
    expect(postsTo(fetchMock, THEME_SETTINGS)).toEqual([])
    expect(postsTo(fetchMock, SETTINGS)).toEqual([])
    // The bridge is not there (no session served): a new link after each save, the newest shown
    const links = () => postsTo(fetchMock, `${PATH}/preview`).length
    await waitFor(() => {
      expect(links()).toBeGreaterThan(2)
      expect(screen.getByTitle("Vitrin önizlemesi")).toHaveAttribute(
        "src",
        expect.stringContaining(`/onizleme/sfl_${String(links())}`)
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
    const primary = await openTheme(
      { theme: { colors: { ...THEME.colors, primary: "#2f8dff" } } },
      "Şekiller"
    )
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
    await toTheme()
    await openGroups(user, "Şekiller")
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
    await openTheme({}, "Şekiller")
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
