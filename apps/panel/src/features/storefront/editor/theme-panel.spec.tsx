import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import {
  SETTINGS,
  THEME,
  THEME_SETTINGS,
  layoutOf,
  opened,
  postsTo,
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

// Each test opens the editor, picks from lists and saves
const HEAVY = { timeout: 15_000 }
const CONTRAST = /yeterince okunmuyor/
const save = () => screen.getByRole("button", { name: "Kaydet ve yayınla" })

/** The editor with the theme's settings open. */
async function openTheme(options: ServeOptions = {}) {
  serve(fetchMock, admin, layoutOf(), options)
  renderEditor()
  const tree = await opened()
  await userEvent.click(within(tree).getByRole("button", { name: "Tema ayarları" }))
  return screen.findByRole("textbox", { name: "Ana renk" })
}

const themeBody = () => postsTo(fetchMock, THEME_SETTINGS).at(-1)?.[1]?.body

describe("the theme settings", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it("saves every choice as one body, live at once, and reloads the preview", HEAVY, async () => {
    const primary = await openTheme()
    const preview = await screen.findByTitle("Vitrin önizlemesi")
    expect(preview).toHaveAttribute("src", expect.stringContaining("/onizleme/sfl_1"))
    expect(screen.getByText(/taslağa bağlı değildir/)).toBeVisible()
    expect(save()).toBeDisabled()

    await userEvent.type(primary, "#0B5C99")
    await userEvent.click(screen.getByRole("combobox", { name: "Başlıklar" }))
    await userEvent.click(await screen.findByRole("option", { name: /Playfair Display/ }))
    await userEvent.click(screen.getByRole("radio", { name: "Nötr" }))
    await userEvent.click(screen.getByRole("switch", { name: /^Puanı göster/ }))
    await userEvent.click(save())

    await waitFor(() => {
      expect(postsTo(fetchMock, THEME_SETTINGS)).toHaveLength(1)
    })
    expect(themeBody()).toEqual({
      colors: { primary: "#0b5c99", accent: null, background: "neutral" },
      typography: { heading: "playfair", body: "inter" },
      radius: "soft",
      product_card: { ratio: "4:5", show_brand: true, show_rating: true },
      header: { layout: "centered", sticky: true },
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

  it(
    "shows a main colour that does not read on the page under it, and the server's refusal",
    HEAVY,
    async () => {
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

      // Over 3:1 on white and on the neutral page, not on the warm one
      await userEvent.type(primary, "#2f8dff")
      expect(screen.getByRole("alert")).toHaveTextContent(CONTRAST)
      expect(primary).toHaveAttribute("aria-invalid", "true")
      await userEvent.click(save())
      expect(postsTo(fetchMock, THEME_SETTINGS)).toEqual([])

      await userEvent.click(screen.getByRole("radio", { name: "Nötr" }))
      expect(screen.queryByRole("alert")).toBeNull()

      refuse = true
      await userEvent.click(save())
      expect(await screen.findByRole("alert")).toHaveTextContent(CONTRAST)
      expect(postsTo(fetchMock, THEME_SETTINGS)).toHaveLength(1)
      expect(toast.error).not.toHaveBeenCalled()
    }
  )

  it("moves the old main colour into the theme with the next save", HEAVY, async () => {
    const primary = await openTheme({ storefront: { primary_color: "#0b5c99" } })
    expect(primary).toHaveValue("#0b5c99")
    expect(screen.getByText(/eski ayardan geliyor/)).toBeVisible()

    await userEvent.click(screen.getByRole("combobox", { name: "Köşeler" }))
    await userEvent.click(await screen.findByRole("option", { name: "Keskin" }))
    await userEvent.click(save())

    await waitFor(() => {
      expect(themeBody()).toMatchObject({
        colors: { primary: "#0b5c99", accent: null, background: "warm" },
        radius: "sharp",
      })
    })
    expect(postsTo(fetchMock, SETTINGS)).toEqual([])
  })

  it("puts a colour back to the theme's own as none", HEAVY, async () => {
    const primary = await openTheme({ theme: { colors: { ...THEME.colors, accent: "#c2410c" } } })
    const accent = screen.getByRole("textbox", { name: "Vurgu rengi" })
    expect(primary).toHaveValue("")
    expect(primary).toHaveAttribute("placeholder", "Temanın rengi")
    expect(accent).toHaveValue("#c2410c")

    await userEvent.click(screen.getByRole("button", { name: "Varsayılan" }))
    expect(accent).toHaveValue("")
    await userEvent.click(save())

    await waitFor(() => {
      expect(themeBody()).toMatchObject({ colors: { primary: null, accent: null } })
    })
  })
})
