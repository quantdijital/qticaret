import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { StoreSettings } from "@/features/settings/api/sections"
import { asset } from "@/features/media/media.fixtures"
import { STORE } from "@/features/settings/pages/store-page.fixtures"
import { EtbisQrCard } from "./etbis-qr-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { upload: { create: vi.fn() } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const URL = "/admin/platform-settings/store"
const QR = asset("media_qr", { filename: "etbis-karekod.png", mime_type: "image/png" })

function renderCard(saved: StoreSettings) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <EtbisQrCard saved={saved} />
    </QueryClientProvider>
  )
}

describe("EtbisQrCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string, init?: { body?: object }) =>
      Promise.resolve(
        url === "/admin/media"
          ? { media: [QR], count: 1 }
          : { section: "store", values: { ...STORE, ...init?.body }, version: 2 }
      )
    )
  })

  it("chooses the QR code from the library and saves its address", async () => {
    renderCard(STORE)

    expect(screen.getByText("Karekod yok")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "ETBİS karekodu: görsel seç" }))
    const picker = await screen.findByRole("dialog")
    await userEvent.click(await within(picker).findByRole("button", { name: "etbis-karekod.png" }))
    await userEvent.click(within(picker).getByRole("button", { name: "Seç" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { etbis_qr_url: QR.url },
      })
    })
  })

  it("takes the QR code off as none", async () => {
    renderCard({ ...STORE, etbis_qr_url: "https://cdn.example.com/karekod.png" })

    await userEvent.click(screen.getByRole("button", { name: "ETBİS karekodu: görseli kaldır" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { etbis_qr_url: null },
      })
    })
  })
})
