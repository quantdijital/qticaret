import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AttributeTemplate } from "@/features/attributes/types"
import { AttributesPage } from "./attributes-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/settings">{children}</a>,
  // adr/0052 Ek 2026-11-23: an add-on template's row opens its page
  useNavigate: () => vi.fn(),
}))

const template = (more: Partial<AttributeTemplate>): AttributeTemplate => ({
  id: "tpl_1",
  name: "Bıçak",
  handle: "bicak",
  description: "Mutfak ve av bıçakları",
  groups: null,
  definitions: [],
  ...more,
})

const SHOP = [
  template({}),
  template({ id: "tpl_2", name: "Mobilya", handle: "mobilya", description: null }),
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AttributesPage />
    </QueryClientProvider>
  )
}

describe("AttributesPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("lists the templates one row each, and a row opens its template", async () => {
    fetchMock.mockResolvedValue({ attribute_templates: SHOP, count: 2 })
    renderPage()

    const knife = (await screen.findByRole("button", { name: "Bıçak" })).closest("tr")
    if (!knife) throw new Error("no row")
    expect(within(knife).getByText("Mutfak ve av bıçakları")).toBeInTheDocument()
    expect(within(knife).getByText("0 özellik")).toBeInTheDocument()

    await userEvent.click(within(knife).getByText("0 özellik"))
    const dialog = await screen.findByRole("dialog", { name: "Bıçak" })
    expect(within(dialog).getByText("1 / 2")).toBeInTheDocument()
  })

  it("offers the first template when there is none", async () => {
    fetchMock.mockResolvedValue({ attribute_templates: [], count: 0 })
    renderPage()

    expect(await screen.findByText(/Henüz şablon yok/)).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Şablon oluştur" })).toHaveLength(2)
  })
})
