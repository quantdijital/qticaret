import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import type { GlobalSearch } from "@/features/search/api"
import { CommandMenu } from "./command-menu"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))
vi.mock("@/features/auth/api/me", () => ({ useLogout: () => ({ mutate: vi.fn() }) }))

const FOUND: GlobalSearch = {
  orders: [
    {
      id: "order_217",
      display_id: 217,
      name: "Can Deneme",
      total: "280.30",
      currency_code: "try",
    },
  ],
  customers: [{ id: "cus_1", name: "Can Deneme", email: "can@example.com" }],
  products: [{ id: "prod_1", title: "El Dokuma Havlu", sku: "HAVLU-217" }],
  parcels: [
    { order_id: "order_217", display_id: 217, tracking_number: "AR217TR", provider: "aras" },
  ],
}

function renderMenu(onOpenChange = vi.fn(), can: Record<string, boolean> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // What the shell asked already: the menu only reads it
  client.setQueryData(STAFF_KEY, { user_id: "user_1", role: "owner", can })
  render(
    <QueryClientProvider client={client}>
      <CommandMenu open onOpenChange={onOpenChange} />
    </QueryClientProvider>
  )
  return onOpenChange
}

describe("CommandMenu search", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(FOUND)
    vi.clearAllMocks()
  })

  it("finds orders, parcels, customers and products, and opens the one picked", async () => {
    const user = userEvent.setup()
    const onOpenChange = renderMenu()

    await user.type(screen.getByRole("combobox"), "217")

    expect(await screen.findByText("#217")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith("/admin/global-search", { query: { q: "217" } })
    expect(screen.getByText("AR217TR")).toBeInTheDocument()
    expect(screen.getByText("can@example.com")).toBeInTheDocument()
    expect(screen.getByText("HAVLU-217")).toBeInTheDocument()

    await user.click(screen.getByText("El Dokuma Havlu"))

    expect(navigate).toHaveBeenCalledWith({ to: "/products/$id", params: { id: "prod_1" } })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("asks nothing for a single letter, and still offers the pages", async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.type(screen.getByRole("combobox"), "s")

    expect(screen.getByText("Siparişler")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("CommandMenu SEO tabs (Settings > SEO, the owner, 2026-11-23)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(FOUND)
    vi.clearAllMocks()
  })

  it("offers none before anything is typed, and SEO is no page of its own", () => {
    renderMenu()

    expect(screen.queryByText("Yönlendirmeler")).toBeNull()
    expect(screen.queryByText("SEO")).toBeNull()
  })

  it("finds a tab by its name and opens it", async () => {
    const user = userEvent.setup()
    const onOpenChange = renderMenu()

    await user.type(screen.getByRole("combobox"), "yönlendir")
    await user.click(await screen.findByText("Yönlendirmeler"))

    expect(navigate).toHaveBeenCalledWith({ to: "/settings/seo", search: { part: "redirects" } })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("lists the tabs under SEO with their trail, its settings only for a role that may change them", async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.type(screen.getByRole("combobox"), "seo")

    expect(await screen.findByText("Genel bakış")).toBeInTheDocument()
    for (const name of ["Öneriler", "Denetim", "Yönlendirmeler", "Site araması"]) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    expect(screen.getAllByText("Ayarlar › SEO ›").length).toBeGreaterThanOrEqual(5)
    expect(screen.queryByText("Adresler")).toBeNull()
  })

  it("adds the settings tabs for the owner", async () => {
    const user = userEvent.setup()
    renderMenu(vi.fn(), { settings: true })

    await user.type(screen.getByRole("combobox"), "seo")

    expect(await screen.findByText("Adresler")).toBeInTheDocument()
    expect(screen.getByText("Başlıklar ve görsel")).toBeInTheDocument()
  })
})

describe("CommandMenu screens by everyday words (adr/0079 Y1-0)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ orders: [], customers: [], products: [], parcels: [] })
    vi.clearAllMocks()
  })

  it("puts the shipping rates first for 'kargo ücreti', with its trail and help, and opens it", async () => {
    const user = userEvent.setup()
    const onOpenChange = renderMenu(vi.fn(), { settings: true })

    await user.type(screen.getByRole("combobox"), "kargo ücreti")

    const first = (await screen.findAllByRole("option"))[0]
    expect(first).toHaveTextContent("Ayarlar › Kargo ve teslimat › Seçenekler ve ücretler")
    expect(first).toHaveTextContent("kargo ücretleri, ücretsiz kargo sınırı")
    await user.click(screen.getByText("Seçenekler ve ücretler"))

    expect(navigate).toHaveBeenCalledWith({ to: "/settings/shipping", search: { part: "options" } })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("finds it whatever the case and Turkish letters", async () => {
    const user = userEvent.setup()
    renderMenu(vi.fn(), { settings: true })

    await user.type(screen.getByRole("combobox"), "KARGO UCRETI")

    expect(await screen.findByText("Seçenekler ve ücretler")).toBeInTheDocument()
  })

  it("offers no settings screen to a role without settings", async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.type(screen.getByRole("combobox"), "kargo ücreti")

    expect(await screen.findByText("Sonuç bulunamadı.")).toBeInTheDocument()
    expect(screen.queryByText("Seçenekler ve ücretler")).toBeNull()
  })

  it("keeps the pages and shortcuts before anything is typed", () => {
    renderMenu()

    expect(screen.getByText("Siparişler")).toBeInTheDocument()
    expect(screen.getByText("Ürün ekle")).toBeInTheDocument()
    expect(screen.getByText("Görünüm ayarları")).toBeInTheDocument()
    expect(screen.queryByText("Ekranlar")).toBeNull()
  })

  it("opens a shortcut with its search", async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(screen.getByText("Hazırlanacak siparişler"))

    expect(navigate).toHaveBeenCalledWith({ to: "/orders", search: { stage: "to_ship" } })
  })
})

describe("CommandMenu shortcut", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("toggles on Ctrl+K", () => {
    const onOpenChange = renderMenu()

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "K", ctrlKey: true }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("ignores a keydown without a key, as browser autofill sends", () => {
    const onOpenChange = renderMenu()
    // A listener that throws is reported on window, not to the dispatcher
    const errors: unknown[] = []
    const onError = (event: ErrorEvent) => {
      event.preventDefault()
      errors.push(event.error)
    }
    window.addEventListener("error", onError)
    // Autofill's synthetic keydown carries no key at all
    const event = new KeyboardEvent("keydown", { ctrlKey: true })
    Object.defineProperty(event, "key", { value: undefined })

    window.dispatchEvent(event)
    window.removeEventListener("error", onError)

    expect(errors).toEqual([])
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
