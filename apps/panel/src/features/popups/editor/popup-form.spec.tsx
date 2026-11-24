import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PopupType } from "@/features/popups/api/types"
import { popupFixture } from "@/features/popups/popups.fixtures"
import { PopupForm } from "./popup-form"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => navigate,
  useBlocker: () => ({ status: "idle" }),
}))

const PROMOTIONS = [
  { id: "promo_1", code: "KIS10", status: "active", is_automatic: false },
  { id: "promo_2", code: null, status: "active", is_automatic: true },
]

// A save goes past the SDK (`savePopup`), to keep the refusal's key
const saveMock = vi.fn<typeof fetch>()

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function renderForm(type: PopupType = "info", canWrite = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PopupForm existing={null} type={type} canWrite={canWrite} />
    </QueryClientProvider>
  )
}

const sent = () =>
  JSON.parse(saveMock.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>

describe("PopupForm (adr/0080 S2)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    toast.error.mockReset()
    saveMock.mockReset()
    fetchMock.mockImplementation((url: string) =>
      url === "/admin/promotion-board"
        ? Promise.resolve({ promotions: PROMOTIONS, batch_counts: {} })
        : Promise.reject(new Error(`unexpected ${url}`))
    )
    vi.stubGlobal("fetch", saveMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("creates an info pop-up from its name and title, the rest at the defaults", async () => {
    saveMock.mockResolvedValue(json(201, { popup: popupFixture({ id: "popup_9" }) }))
    renderForm()

    await userEvent.type(screen.getByLabelText(/^Ad/), "Kargo duyurusu")
    await userEvent.type(screen.getByLabelText(/^Başlık/), "500 TL üzeri kargo bedava")
    expect(screen.getAllByText("500 TL üzeri kargo bedava").length).toBeGreaterThan(0)
    await userEvent.click(screen.getByLabelText("Kaydedince yayınla"))
    await userEvent.click(screen.getByRole("button", { name: "Pop-up oluştur" }))

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1)
    })
    expect(saveMock.mock.calls[0]?.[0]).toBe("/admin/popups")
    expect(sent()).toMatchObject({
      name: "Kargo duyurusu",
      type: "info",
      is_active: true,
      title: "500 TL üzeri kargo bedava",
      button_href: null,
      promotion_id: null,
      trigger: "delay",
      trigger_value: 5,
      frequency: "days",
      frequency_days: 7,
    })
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: "/popups/$id",
        params: { id: "popup_9" },
        ignoreBlocker: true,
      })
    })
  })

  it("does not send a campaign without its promotion", async () => {
    renderForm("campaign")

    expect(await screen.findByText("İndirim")).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/^Ad/), "Kış")
    await userEvent.type(screen.getByLabelText(/^Başlık/), "Kışa özel")
    await userEvent.click(screen.getByRole("button", { name: "Pop-up oluştur" }))

    expect(await screen.findByText("Bir indirim seçin.")).toBeInTheDocument()
    expect(saveMock).not.toHaveBeenCalled()
  })

  it("offers a newsletter's submit words and no link", () => {
    renderForm("newsletter")

    expect(screen.getByLabelText("Düğme yazısı")).toBeInTheDocument()
    expect(screen.queryByLabelText("Düğme bağlantısı")).toBeNull()
    expect(screen.getAllByText("Kaydol").length).toBeGreaterThan(0)
  })

  it("puts a backend refusal under its field", async () => {
    saveMock.mockResolvedValue(
      json(400, {
        type: "invalid_data",
        code: "popups.button_link_not_allowed",
        message: "Bülten pop-up'ının düğmesi formu gönderir; bağlantı almaz.",
      })
    )
    renderForm()

    await userEvent.type(screen.getByLabelText(/^Ad/), "Kargo")
    await userEvent.type(screen.getByLabelText(/^Başlık/), "Kargo bedava")
    await userEvent.click(screen.getByRole("button", { name: "Pop-up oluştur" }))

    expect(
      await screen.findByText("Bülten pop-up'ının düğmesi formu gönderir; bağlantı almaz.", {
        selector: "[role=alert]",
      })
    ).toBeInTheDocument()
  })

  it("is read-only and has no save for a role that may not write", () => {
    renderForm("info", false)

    expect(screen.getByLabelText(/^Başlık/)).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Pop-up oluştur" })).toBeNull()
  })
})
