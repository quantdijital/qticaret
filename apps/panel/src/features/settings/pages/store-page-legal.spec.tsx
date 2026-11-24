import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { answer, card, posts, renderPage } from "./store-page.fixtures"
import type { Init } from "./store-page.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
// The open tab, as the address holds it (`?part=`)
const search = vi.hoisted(() => ({ current: {} }))

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: {
      store: { list: () => Promise.resolve({ stores: [{ id: "store_1", name: "Örnek Bıçak" }] }) },
    },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => search.current,
  useNavigate: () => vi.fn(),
}))

const LEGAL_URL = "/admin/platform-settings/legal"

describe("StorePage: legal identity and social accounts", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    answer(fetchMock)
  })

  it("asks only the legal fields, and says what the contact tab still lacks", async () => {
    search.current = { part: "legal" }
    renderPage()
    const mersis = await screen.findByRole("textbox", { name: "MERSİS numarası" })
    const identity = card("Yasal kimlik")
    // The ETBİS QR code is a thin row of the identity, no card of its own
    expect(within(identity).getByText("Karekod yok")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "ETBİS karekodu" })).toBeNull()

    expect(within(identity).getByText(/^Eksik:/)).toHaveTextContent(
      "Eksik: açık adres (İletişim sekmesinde)."
    )
    // The address is a contact detail, the accounts have their own tab
    expect(screen.queryByRole("textbox", { name: "Açık adres" })).toBeNull()
    expect(screen.queryByRole("textbox", { name: "Sosyal medya hesapları" })).toBeNull()

    await userEvent.type(mersis, "0123456789012345")
    await userEvent.click(within(identity).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(LEGAL_URL, {
        method: "POST",
        body: {
          company_title: "Örnek Bıçak Ltd. Şti.",
          mersis: "0123456789012345",
          tax_office: "Kadıköy",
          tax_number: "1234567890",
          kep: "",
          etbis: "",
          document_name: "",
          document_number: "",
          document_holder: "",
        },
      })
    })
  })

  it("saves the licence line the shop's trade asks for, under the name it gives it", async () => {
    search.current = { part: "legal" }
    renderPage()
    const name = await screen.findByRole("textbox", { name: "Belge adı" })
    const identity = card("Yasal kimlik")
    expect(within(identity).getByText("Faaliyet belgesi")).toBeInTheDocument()

    await userEvent.type(name, "TÜRSAB belge no")
    await userEvent.type(screen.getByRole("textbox", { name: "Belge numarası" }), "12345")
    await userEvent.click(within(identity).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      const [, init] = posts(fetchMock).find(([url]) => url === LEGAL_URL) ?? []
      expect(init?.body).toMatchObject({
        document_name: "TÜRSAB belge no",
        document_number: "12345",
        document_holder: "",
      })
    })
  })

  it("adds a social account and saves the list whole", async () => {
    search.current = { part: "social" }
    renderPage()
    await screen.findByRole("textbox", { name: "1. hesabın adresi" })
    const social = card("Sosyal hesaplar")

    await userEvent.click(within(social).getByRole("button", { name: "Hesap ekle" }))
    await userEvent.type(
      within(social).getByRole("textbox", { name: "2. hesabın adresi" }),
      " https://youtube.com/@ornek "
    )
    await userEvent.click(within(social).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(LEGAL_URL, {
        method: "POST",
        body: { same_as: ["https://instagram.com/ornek", "https://youtube.com/@ornek"] },
      })
    })
  })

  it("refuses an account address that is not https", async () => {
    search.current = { part: "social" }
    renderPage()
    await screen.findByRole("textbox", { name: "1. hesabın adresi" })
    const social = card("Sosyal hesaplar")

    await userEvent.click(within(social).getByRole("button", { name: "Hesap ekle" }))
    await userEvent.type(
      within(social).getByRole("textbox", { name: "2. hesabın adresi" }),
      "instagram.com/ornek"
    )
    await userEvent.click(within(social).getByRole("button", { name: "Kaydet" }))

    expect(await within(social).findByRole("alert")).toHaveTextContent(
      "Adres https:// ile başlamalı."
    )
    expect(posts(fetchMock)).toEqual([])
  })
})
