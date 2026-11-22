import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import type { FoundTraveler } from "@/features/customers/api/traveler-requests"
import { travelerCopyOf } from "@/features/customers/traveler-copy"
import { TravelerRequestsPage } from "./traveler-requests-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode
    to: string
    params?: { id: string }
  }) => <a href={params ? `/orders/${params.id}` : to}>{children}</a>,
}))

const FOUND: FoundTraveler = {
  id: "bktrv_1",
  first_name: "Ayşe",
  last_name: "Yılmaz",
  birth_date: "1990-01-15",
  nationality: "TR",
  document_masked: "***5678",
  starts_at: "2099-05-02T06:00:00.000Z",
  product_title: "Kapadokya turu",
  order_id: "order_1",
  display_id: 1042,
  created_at: "2099-04-01T10:00:00.000Z",
  purge_after: "2099-10-29T06:00:00.000Z",
}

function setup({ can = true, flag = true, found = [FOUND] } = {}) {
  let rows = found
  fetchMock.mockImplementation((url: string, init?: { body?: { ids?: string[] } }) => {
    if (url === "/admin/features") {
      return Promise.resolve({ features: [{ key: "catalog.booking", enabled: flag }] })
    }
    if (url.endsWith("/erase")) {
      const ids = init?.body?.ids ?? []
      rows = rows.filter((row) => !ids.includes(row.id))
      return Promise.resolve({ deleted: ids.length })
    }
    return Promise.resolve({ travelers: rows })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(STAFF_KEY, {
    user_id: "user_1",
    role: can ? "owner" : "operations",
    can: { travelerRequests: can },
  })
  render(
    <QueryClientProvider client={client}>
      <TravelerRequestsPage />
    </QueryClientProvider>
  )
}

async function search(fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) {
    // The label as read, its "required" mark aside
    const pattern = new RegExp(`^${label}\\*?$`)
    await userEvent.type(await screen.findByLabelText(pattern), value)
  }
  await userEvent.click(screen.getByRole("button", { name: "Ara" }))
}

describe("TravelerRequestsPage (adr/0076 Ek D6b)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("is closed to those who may not, and while dated sales are off", async () => {
    setup({ can: false })
    expect(
      await screen.findByText("Bu ekranı yalnız mağaza sahibi ve yöneticiler kullanabilir.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Ara" })).toBeNull()
  })

  it("asks for the name before searching", async () => {
    setup()
    await userEvent.click(await screen.findByRole("button", { name: "Ara" }))
    expect(await screen.findByText("Adı yazın.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/booking-travelers/search", expect.anything())
  })

  it("searches by what is given, leaving empty fields out, and lists the rows masked", async () => {
    setup()
    await search({ Ad: "Ayşe", Soyad: "Yılmaz", "Kimlik ya da pasaport no": "U1234 5678" })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/booking-travelers/search", {
        method: "POST",
        body: { first_name: "Ayşe", last_name: "Yılmaz", document_no: "U1234 5678" },
      })
    })
    expect(await screen.findByText("1 kayıt bulundu.")).toBeInTheDocument()
    const row = screen.getByText("Ayşe Yılmaz").closest("tr") as HTMLElement
    expect(within(row).getByText("15.01.1990 · Türkiye · ***5678")).toBeInTheDocument()
    expect(within(row).getByRole("link", { name: "#1042" })).toHaveAttribute(
      "href",
      "/orders/order_1"
    )
  })

  it("deletes the rows picked after asking, then searches again", async () => {
    setup()
    await search({ Ad: "Ayşe", Soyad: "Yılmaz" })
    await userEvent.click(await screen.findByRole("button", { name: "Seçilenleri sil" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(within(confirm).getByText("1 katılımcı kaydı silinsin mi?")).toBeInTheDocument()
    await userEvent.click(within(confirm).getByRole("button", { name: "Kalıcı sil" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/booking-travelers/erase", {
        method: "POST",
        body: { ids: ["bktrv_1"] },
      })
    })
    expect(
      await screen.findByText("Bu bilgilerle kayıtlı katılımcı bulunamadı.")
    ).toBeInTheDocument()
  })

  it("says so when nothing is found", async () => {
    setup({ found: [] })
    await search({ Ad: "Ali", Soyad: "Kaya" })
    expect(
      await screen.findByText("Bu bilgilerle kayıtlı katılımcı bulunamadı.")
    ).toBeInTheDocument()
  })
})

describe("a traveler's copy", () => {
  it("is in Turkish, the number masked", () => {
    const copy = travelerCopyOf([FOUND], new Date("2099-06-01T00:00:00Z"))
    expect(copy).toEqual({
      hazırlanma: "2099-06-01T00:00:00.000Z",
      katılımcı_kayıtları: [
        {
          ad: "Ayşe",
          soyad: "Yılmaz",
          doğum_tarihi: "1990-01-15",
          uyruk: "TR",
          kimlik_ya_da_pasaport_no: "***5678",
          ürün: "Kapadokya turu",
          hizmet_tarihi: "2099-05-02T06:00:00.000Z",
          sipariş: 1042,
          kayıt_tarihi: "2099-04-01T10:00:00.000Z",
          silinme_tarihi: "2099-10-29T06:00:00.000Z",
        },
      ],
    })
  })
})
