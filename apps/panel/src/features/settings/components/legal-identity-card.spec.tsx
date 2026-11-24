import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { asset } from "@/features/media/media.fixtures"
import { LEGAL, STORE } from "@/features/settings/pages/store-page.fixtures"
import { LegalIdentityCard } from "./legal-identity-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { upload: { create: vi.fn() } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const STORE_URL = "/admin/platform-settings/store"
const LEGAL_URL = "/admin/platform-settings/legal"
const QR = asset("media_qr", { filename: "etbis-karekod.png", mime_type: "image/png" })

function renderCard(qrUrl: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <LegalIdentityCard saved={LEGAL} qrUrl={qrUrl} hasContact />
    </QueryClientProvider>
  )
}

const posted = () =>
  fetchMock.mock.calls
    .filter(([, init]) => (init as { method?: string } | undefined)?.method === "POST")
    .map(([url]) => url as string)

describe("LegalIdentityCard: the ETBİS QR code row", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string, init?: { body?: object }) => {
      if (url === "/admin/media") return Promise.resolve({ media: [QR], count: 1 })
      const legal = url === LEGAL_URL
      return Promise.resolve({
        section: legal ? "legal" : "store",
        values: { ...(legal ? LEGAL : STORE), ...init?.body },
        version: 2,
      })
    })
  })

  it("shows a small thumbnail with replace and remove when a code is set", () => {
    renderCard("https://cdn.example.com/karekod.png")

    expect(screen.getByRole("img", { name: "ETBİS karekodu" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/karekod.png"
    )
    expect(screen.getByText("Karekod eklendi")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "ETBİS karekodu: görseli değiştir" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "ETBİS karekodu: görseli kaldır" })
    ).toBeInTheDocument()
  })

  it("chooses the code from the library and saves only the store section", async () => {
    renderCard(null)

    expect(screen.getByText("Karekod yok")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /görseli kaldır/ })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "ETBİS karekodu: görsel seç" }))
    const picker = await screen.findByRole("dialog")
    await userEvent.click(await within(picker).findByRole("button", { name: "etbis-karekod.png" }))
    await userEvent.click(within(picker).getByRole("button", { name: "Seç" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(STORE_URL, {
        method: "POST",
        body: { etbis_qr_url: QR.url },
      })
    })
    expect(posted()).toEqual([STORE_URL])
  })

  it("takes the code off as none", async () => {
    renderCard("https://cdn.example.com/karekod.png")

    await userEvent.click(screen.getByRole("button", { name: "ETBİS karekodu: görseli kaldır" }))
    expect(screen.getByText("Karekod yok")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(STORE_URL, {
        method: "POST",
        body: { etbis_qr_url: null },
      })
    })
  })

  it("saves both sections when the number and the code change together", async () => {
    renderCard("https://cdn.example.com/karekod.png")

    await userEvent.type(screen.getByRole("textbox", { name: "ETBİS kayıt numarası" }), "ETB-1")
    await userEvent.click(screen.getByRole("button", { name: "ETBİS karekodu: görseli kaldır" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(posted()).toEqual([LEGAL_URL, STORE_URL])
    })
    const legalBody = fetchMock.mock.calls.find(([url]) => url === LEGAL_URL)?.[1] as {
      body: Record<string, unknown>
    }
    expect(legalBody.body).toMatchObject({ etbis: "ETB-1" })
    expect(legalBody.body).not.toHaveProperty("etbis_qr_url")
  })
})
