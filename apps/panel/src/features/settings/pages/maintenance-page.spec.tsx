import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MaintenanceSettings } from "@/features/storefront/api/maintenance"
import { MaintenancePage } from "./maintenance-page"

interface Init {
  method?: string
  body?: unknown
}

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

/** The shop's details as `GET /admin/shop-tokens` gives them (adr/0048); the address not given. */
const SHOP_TOKENS = [
  { name: "mağaza_adı", value: "Örnek Bıçak" },
  { name: "telefon", value: "0212 123 45 67" },
  { name: "e_posta", value: "destek@ornek.com" },
  { name: "adres", value: null },
  { name: "whatsapp", value: "0532 123 45 67" },
  { name: "ücretsiz_kargo_eşiği", value: "₺1.500" },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MaintenancePage />
    </QueryClientProvider>
  )
}

/** The card under a title; each has its own save button. */
function card(title: string): HTMLElement {
  const section = screen.getByRole("heading", { name: title }).closest<HTMLElement>("section")
  if (!section) throw new Error(`No card titled ${title}`)
  return section
}

const URL = "/admin/platform-settings/maintenance"
const BYPASS = "/admin/maintenance/bypass"
const LINK = {
  url: "https://ornekbicak.com/bakim/gir?t=mnb_abc.123.sig",
  path: "/bakim/gir?t=mnb_abc.123.sig",
  expires_at: "2026-11-10T09:00:00.000Z",
}
const OFF: MaintenanceSettings = {
  enabled: false,
  title: null,
  message: null,
  expected_at: null,
  allow_paths: ["/iletisim"],
}

interface Server {
  role?: "owner" | "admin" | "operations"
  stored?: Partial<MaintenanceSettings>
  bypass?: () => Promise<unknown>
}

/** The server: who is signed in, the section (each save a new version), the link. */
function serve({ role = "owner", stored = {}, bypass }: Server = {}) {
  let values = { ...OFF, ...stored }
  let version = 3
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/staff/me") {
      const can = { maintenance: role === "owner", settings: role !== "operations" }
      return Promise.resolve({ user_id: "user_1", role, can, mfa: {} })
    }
    if (url === URL) {
      if (init?.method === "POST") {
        values = { ...values, ...(init.body as Partial<MaintenanceSettings>) }
        version++
      }
      return Promise.resolve({ section: "maintenance", values, version })
    }
    if (url === BYPASS) {
      return bypass ? bypass() : Promise.resolve(LINK)
    }
    if (url === "/admin/shop-tokens") {
      return Promise.resolve({ tokens: SHOP_TOKENS })
    }
    return Promise.resolve({})
  })
}

const posts = (url: string) =>
  fetchMock.mock.calls.filter(([to, init]) => to === url && init?.method === "POST")
const toggle = () => screen.findByRole("switch", { name: /^Vitrini bakıma al/ })

/** A card once the section is in. */
async function findCard(title: string) {
  await screen.findByRole("heading", { name: title })
  return card(title)
}

describe("Settings > Maintenance (adr/0053)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it("lets the owner turn maintenance on once confirmed; the header says so", async () => {
    serve()
    renderPage()
    expect(await screen.findByRole("heading", { level: 1, name: "Bakım modu" })).toBeVisible()
    const on = await toggle()
    await waitFor(() => {
      expect(on).toBeEnabled()
    })
    expect(on).not.toBeChecked()

    // Turned back at the question: nothing is saved
    await userEvent.click(on)
    let dialog = await screen.findByRole("alertdialog", { name: "Vitrin bakıma alınsın mı?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Vazgeç" }))
    expect(posts(URL)).toEqual([])
    expect(on).not.toBeChecked()

    await userEvent.click(on)
    dialog = await screen.findByRole("alertdialog", { name: "Vitrin bakıma alınsın mı?" })
    expect(dialog).toHaveTextContent("bakım sayfasını görür (503)")
    expect(dialog).toHaveTextContent("önceki atlatma bağlantılarını geçersiz kılar")
    await userEvent.click(within(dialog).getByRole("button", { name: "Bakım modunu aç" }))

    await waitFor(() => {
      expect(posts(URL)).toEqual([[URL, expect.objectContaining({ body: { enabled: true } })]])
    })
    expect(await screen.findByText("Mağaza bakımda")).toBeVisible()
    expect(on).toBeChecked()
    expect(toast.success).toHaveBeenCalledWith(
      "Bakım modu açıldı; vitrinde en geç bir dakikada görünür."
    )
  })

  it("saves the page's texts: none for an empty field, the return with its offset, paths cleaned", async () => {
    serve()
    renderPage()
    const page = await findCard("Bakım sayfası")
    const title = await within(page).findByRole("textbox", { name: "Başlık" })
    await waitFor(() => {
      expect(title).toBeEnabled()
    })

    await userEvent.type(title, "Yeni sezona hazırlanıyoruz")
    fireEvent.change(within(page).getByLabelText("Beklenen dönüş"), {
      target: { value: "2026-11-10T09:00" },
    })
    await userEvent.click(within(page).getByRole("button", { name: "Yol ekle" }))
    const path = within(page).getByRole("textbox", { name: "2. yol" })
    await userEvent.type(path, "/a?b")
    await userEvent.click(within(page).getByRole("button", { name: "Kaydet" }))
    expect(await within(page).findByRole("alert")).toHaveTextContent("Yol / ile başlamalı")
    expect(posts(URL)).toEqual([])

    await userEvent.clear(path)
    await userEvent.type(path, "/Sozlesmeler/*")
    await userEvent.click(within(page).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(posts(URL)).toHaveLength(1)
    })
    const body = posts(URL)[0]?.[1]?.body as MaintenanceSettings
    expect(body).toEqual({
      enabled: false,
      title: "Yeni sezona hazırlanıyoruz",
      message: null,
      expected_at: expect.stringMatching(/^2026-11-10T09:00:00[+-]\d\d:\d\d$/) as string,
      allow_paths: ["/iletisim", "/sozlesmeler/*"],
    })
    expect(new Date(body.expected_at ?? "").getTime()).toBe(new Date(2026, 10, 10, 9, 0).getTime())
  })

  it("shows the section read-only to anyone but the owner", async () => {
    serve({ role: "admin", stored: { enabled: true, title: "Kısa bir aradayız" } })
    renderPage()

    expect(await toggle()).toBeChecked()
    expect(await screen.findByText(/yalnız mağaza sahibi açıp kapatabilir/)).toBeVisible()
    expect(screen.getByRole("switch", { name: /^Vitrini bakıma al/ })).toBeDisabled()
    expect(screen.getByText(/yalnız mağaza sahibi değiştirebilir/)).toBeVisible()
    expect(screen.getByRole("textbox", { name: "Başlık" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Yol ekle" })).toBeDisabled()
    // The admin still makes a bypass link
    expect(screen.getByRole("button", { name: "Bağlantı oluştur" })).toBeEnabled()
  })

  it("makes a bypass link while on, copies it, and drops it once the section is saved again", async () => {
    const user = userEvent.setup()
    serve({ stored: { enabled: true } })
    renderPage()
    const bypass = await findCard("Bakım modunu atlatma bağlantısı")
    expect(bypass).toHaveTextContent("önceki bağlantıları geçersiz kılar")

    await user.click(await within(bypass).findByRole("button", { name: "Bağlantı oluştur" }))
    const link = await within(bypass).findByRole("textbox", { name: "Bağlantı" })
    expect(link).toHaveValue(LINK.url)
    expect(posts(BYPASS)).toEqual([[BYPASS, { method: "POST", body: {} }]])
    expect(bypass).toHaveTextContent(/tarihine kadar geçerli/)

    await user.click(within(bypass).getByRole("button", { name: "Bağlantıyı kopyala" }))
    await expect(navigator.clipboard.readText()).resolves.toBe(LINK.url)
    expect(toast.success).toHaveBeenCalledWith("Bağlantı kopyalandı.")

    const page = card("Bakım sayfası")
    await user.type(within(page).getByRole("textbox", { name: "Başlık" }), "Az kaldı")
    await user.click(within(page).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(within(bypass).queryByRole("textbox", { name: "Bağlantı" })).toBeNull()
    })
  })

  it("offers the link only while on, and shows a refusal", async () => {
    serve({
      stored: { enabled: true },
      bypass: () =>
        Promise.reject(
          Object.assign(new Error("Bakım modu kapalı."), {
            status: 400,
            code: "maintenance.not_enabled",
          })
        ),
    })
    renderPage()
    const bypass = await findCard("Bakım modunu atlatma bağlantısı")

    await userEvent.click(await within(bypass).findByRole("button", { name: "Bağlantı oluştur" }))
    expect(await within(bypass).findByRole("alert")).toHaveTextContent("Bakım modu kapalı.")
    expect(within(bypass).queryByRole("textbox", { name: "Bağlantı" })).toBeNull()
  })

  it("keeps the link button off while maintenance is off", async () => {
    serve()
    renderPage()
    const bypass = await findCard("Bakım modunu atlatma bağlantısı")

    expect(within(bypass).getByRole("button", { name: "Bağlantı oluştur" })).toBeDisabled()
    expect(bypass).toHaveTextContent("yalnız bakım modu açıkken oluşturulabilir")
  })
})
