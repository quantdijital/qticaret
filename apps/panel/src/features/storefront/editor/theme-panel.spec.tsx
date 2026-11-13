import { screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import {
  SETTINGS,
  THEME,
  THEME_SETTINGS,
  holdClock,
  layoutOf,
  opened,
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

const CONTRAST = /yeterince okunmuyor/
const save = () => screen.getByRole("button", { name: "Kaydet ve yayınla" })

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

const themeBody = () => postsTo(fetchMock, THEME_SETTINGS).at(-1)?.[1]?.body

describe("the theme settings", HEAVY, () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => {
    releaseClock()
  })

  it("saves every choice as one body, live at once, and reloads the preview", async () => {
    const primary = await openTheme()
    const preview = await screen.findByTitle("Vitrin önizlemesi")
    expect(preview).toHaveAttribute("src", expect.stringContaining("/onizleme/sfl_1"))
    expect(screen.getByText(/taslağa bağlı değildir/)).toBeVisible()
    expect(save()).toBeDisabled()

    await user.type(primary, "#0B5C99")
    await user.click(screen.getByRole("combobox", { name: "Başlıklar" }))
    await user.click(await screen.findByRole("option", { name: /Playfair Display/ }))
    await user.click(screen.getByRole("radio", { name: "Nötr" }))
    await user.click(screen.getByRole("switch", { name: /^Puanı göster/ }))
    await user.click(save())

    await waitFor(() => {
      expect(postsTo(fetchMock, THEME_SETTINGS)).toHaveLength(1)
    })
    expect(themeBody()).toEqual({
      colors: { primary: "#0b5c99", accent: null, background: "neutral" },
      typography: { heading: "playfair", body: "manrope" },
      radius: "soft",
      product_card: { ratio: "1:1", show_brand: true, show_rating: true },
      header: { layout: "left", sticky: true },
      buttons: "pill",
    })
    // The main colour lives in the theme now; the draft is not touched
    expect(postsTo(fetchMock, SETTINGS)).toEqual([])
    expect(postsTo(fetchMock)).toEqual([])
    await waitFor(() => {
      expect(screen.getByTitle("Vitrin önizlemesi")).toHaveAttribute(
        "src",
        expect.stringContaining("/onizleme/sfl_2")
      )
    })
    expect(toast.success).toHaveBeenCalledWith(
      "Tema ayarları kaydedildi; vitrinde en geç bir dakikada görünür."
    )
    expect(save()).toBeDisabled()
  })

  it("shows a main colour that does not read on the page under it, and the server's refusal", async () => {
    let refuse = false
    const primary = await openTheme({
      refuseTheme: () =>
        refuse
          ? Object.assign(new Error("Bu renk yeterince okunmuyor."), {
              status: 400,
              code: "platform_settings.color_contrast",
            })
          : null,
    })

    // Over 3:1 on white, on Grafit's steel and on the neutral page, not on the warm one
    await user.type(primary, "#2f8dff")
    expect(screen.queryByRole("alert")).toBeNull()
    await user.click(screen.getByRole("radio", { name: "Sıcak" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(CONTRAST)
    expect(primary).toHaveAttribute("aria-invalid", "true")
    await user.click(save())
    expect(postsTo(fetchMock, THEME_SETTINGS)).toEqual([])

    await user.click(screen.getByRole("radio", { name: "Nötr" }))
    // The field is checked again against the new page colour, which takes a moment
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull()
    })

    refuse = true
    await user.click(save())
    expect(await screen.findByRole("alert")).toHaveTextContent(CONTRAST)
    expect(postsTo(fetchMock, THEME_SETTINGS)).toHaveLength(1)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("moves the old main colour into the theme with the next save", async () => {
    const primary = await openTheme({ storefront: { primary_color: "#0b5c99" } })
    expect(primary).toHaveValue("#0b5c99")
    expect(screen.getByText(/eski ayardan geliyor/)).toBeVisible()

    await user.click(screen.getByRole("combobox", { name: "Köşeler" }))
    await user.click(await screen.findByRole("option", { name: "Keskin" }))
    await user.click(save())

    await waitFor(() => {
      expect(themeBody()).toMatchObject({
        colors: { primary: "#0b5c99", accent: null, background: "steel" },
        radius: "sharp",
      })
    })
    // The old one gives way once the theme holds the colour, after the theme's save
    await waitFor(() => {
      expect(postsTo(fetchMock, SETTINGS).map(([, init]) => init?.body)).toEqual([
        { primary_color: null },
      ])
    })
    const sections = fetchMock.mock.calls
      .filter(
        ([url, init]) => init?.method === "POST" && url.startsWith("/admin/platform-settings")
      )
      .map(([url]) => url)
    expect(sections).toEqual([THEME_SETTINGS, SETTINGS])
    expect(primary).toHaveValue("#0b5c99")
    expect(screen.queryByText(/eski ayardan geliyor/)).toBeNull()
  })

  it("puts the main colour back to the theme's own over an old one, clearing that once", async () => {
    const primary = await openTheme({ storefront: { primary_color: "#0b5c99" } })
    expect(primary).toHaveValue("#0b5c99")

    await user.click(screen.getByRole("button", { name: "Varsayılan" }))
    await user.click(save())

    await waitFor(() => {
      expect(postsTo(fetchMock, SETTINGS)).toHaveLength(1)
    })
    expect(themeBody()).toMatchObject({ colors: { primary: null } })
    expect(postsTo(fetchMock, SETTINGS)[0]?.[1]?.body).toEqual({ primary_color: null })
    // The theme's own colour shows, not the old one
    await waitFor(() => {
      expect(primary).toHaveValue("")
    })
    await waitFor(() => {
      expect(screen.getByTitle("Vitrin önizlemesi")).toHaveAttribute(
        "src",
        expect.stringContaining("/onizleme/sfl_2")
      )
    })

    // A later save leaves the storefront section alone
    await user.click(screen.getByRole("radio", { name: "Nötr" }))
    await user.click(save())
    await waitFor(() => {
      expect(postsTo(fetchMock, THEME_SETTINGS)).toHaveLength(2)
    })
    expect(postsTo(fetchMock, SETTINGS)).toHaveLength(1)
  })

  it("puts a colour back to the theme's own as none", async () => {
    const primary = await openTheme({ theme: { colors: { ...THEME.colors, accent: "#c2410c" } } })
    const accent = screen.getByRole("textbox", { name: "Vurgu rengi" })
    expect(primary).toHaveValue("")
    expect(primary).toHaveAttribute("placeholder", "Temanın rengi")
    expect(accent).toHaveValue("#c2410c")

    await user.click(screen.getByRole("button", { name: "Varsayılan" }))
    expect(accent).toHaveValue("")
    await user.click(save())

    await waitFor(() => {
      expect(themeBody()).toMatchObject({ colors: { primary: null, accent: null } })
    })
  })
})
