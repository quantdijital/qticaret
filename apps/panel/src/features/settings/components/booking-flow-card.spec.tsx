import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { VoucherCheckButton } from "@/features/orders/components/voucher-check"
import type { BookingFlowSettings } from "@/features/settings/api/sections"
import { BookingFlowCard } from "./booking-flow-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const DETAILED: BookingFlowSettings = {
  voucher_enabled: true,
  voucher_off_note: null,
  online_cancel_enabled: true,
  cancel_off_note: null,
}

function serve(booking: boolean, saved: BookingFlowSettings = DETAILED) {
  fetchMock.mockImplementation((url: string, init?: { body?: Partial<BookingFlowSettings> }) => {
    if (url === "/admin/features") {
      return Promise.resolve({ features: [{ key: "catalog.booking", enabled: booking }] })
    }
    if (url === "/admin/platform-settings/booking") {
      return Promise.resolve({ values: { ...saved, ...init?.body } })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

const renderWith = (node: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>)

const VOUCHER = "Voucher gönder"
const CANCEL = "Müşteri sipariş sayfasından iptal edebilsin"

describe("BookingFlowCard (adr/0076 Ek basit yol)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows nothing while the shop does not sell dated products", async () => {
    serve(false)
    const { container } = renderWith(<BookingFlowCard />)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/features")
    })
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText("Rezervasyon akışı")).toBeNull()
    // The section is not even read
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/platform-settings/booking")
  })

  it("keeps both flows on by default, the notes out of sight", async () => {
    serve(true)
    renderWith(<BookingFlowCard />)
    expect(await screen.findByRole("switch", { name: VOUCHER })).toBeChecked()
    expect(screen.getByRole("switch", { name: CANCEL })).toBeChecked()
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  it("turns vouchers off with the shop's note, an empty one the default sentence", async () => {
    serve(true)
    renderWith(<BookingFlowCard />)
    await userEvent.click(await screen.findByRole("switch", { name: VOUCHER }))
    const note = screen.getByRole("textbox", { name: "Voucher yerine e-postadaki not" })
    expect(note).toHaveAttribute(
      "placeholder",
      "Rezervasyon ayrıntıları için sizinle telefon veya e-posta ile iletişime geçeceğiz."
    )
    await userEvent.type(note, "Sizi arayacağız.")
    await userEvent.click(screen.getByRole("switch", { name: CANCEL }))
    expect(
      screen.getByRole("textbox", { name: "İptal yerine sipariş sayfasındaki not" })
    ).toHaveValue("")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/booking", {
        method: "POST",
        body: {
          voucher_enabled: false,
          voucher_off_note: "Sizi arayacağız.",
          online_cancel_enabled: false,
          cancel_off_note: "",
        },
      })
    })
  })
})

describe("VoucherCheckButton and the simple path", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows while the shop has vouchers", async () => {
    serve(true)
    renderWith(<VoucherCheckButton />)
    expect(await screen.findByRole("button", { name: "Voucher doğrula" })).toBeInTheDocument()
  })

  it("hides once the shop runs without vouchers", async () => {
    serve(true, { ...DETAILED, voucher_enabled: false })
    renderWith(<VoucherCheckButton />)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/booking")
    })
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Voucher doğrula" })).toBeNull()
    })
  })
})
