import { QueryClientProvider } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { clientWith, link } from "@/features/payment-links/payment-links.fixtures"
import { orderPaymentLinkId, orderPaymentLinkNumber } from "./order-link"
import { PaymentLinkChip } from "./payment-link-chip"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params: { id: string } }) => (
    <a href={`/payment-links/${params.id}`}>{children}</a>
  ),
}))

function renderChip(client: QueryClient = clientWith(), number: string | null = null) {
  return render(
    <QueryClientProvider client={client}>
      <PaymentLinkChip linkId="plink_01" number={number} />
    </QueryClientProvider>
  )
}

describe("PaymentLinkChip (adr/0051 §13)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ payment_link: link() })
  })

  it("names the link an order came from and opens it", async () => {
    renderChip()

    const chip = await screen.findByRole("link", { name: "Ödeme bağlantısı PL-1042" })
    expect(chip).toHaveAttribute("href", "/payment-links/plink_01")
    expect(fetchMock).toHaveBeenCalledWith("/admin/payment-links/plink_01")
  })

  it("names it without a way in for a role that cannot open the screen", async () => {
    renderChip(clientWith({ role: "readonly" }))

    expect(await screen.findByText("Ödeme bağlantısı PL-1042")).toBeInTheDocument()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("says only where the order came from while the shop has payment links off", () => {
    renderChip(clientWith({ flag: false }))

    expect(screen.getByText("Ödeme bağlantısından")).toBeInTheDocument()
    expect(screen.queryByRole("link")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("names the link by the number the order keeps, reading nothing for it", async () => {
    renderChip(clientWith(), "PL-1043")

    expect(screen.getByRole("link", { name: "Ödeme bağlantısı PL-1043" })).toHaveAttribute(
      "href",
      "/payment-links/plink_01"
    )
    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("names it by the order's number with the feature off too, without a way in", () => {
    renderChip(clientWith({ flag: false }), "PL-1043")

    expect(screen.getByText("Ödeme bağlantısı PL-1043")).toBeInTheDocument()
    expect(screen.queryByRole("link")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("reads the link's number from the order's metadata, and nothing else", () => {
    expect(orderPaymentLinkNumber({ qt_payment_link_number: "PL-1042" })).toBe("PL-1042")
    expect(orderPaymentLinkNumber({ qt_payment_link_number: "<b>PL-1</b>" })).toBeNull()
    expect(orderPaymentLinkNumber({ qt_payment_link_number: 1042 })).toBeNull()
    expect(orderPaymentLinkNumber({ qt_payment_link: "plink_01JX" })).toBeNull()
    expect(orderPaymentLinkNumber(undefined)).toBeNull()
  })

  it("reads the link's id from the order's metadata, and nothing else", () => {
    expect(
      orderPaymentLinkId({ qt_payment_link: "plink_01JX", qt_payment_link_by: "user_1" })
    ).toBe("plink_01JX")
    expect(orderPaymentLinkId({ qt_payment_link: "https://evil.example" })).toBeNull()
    expect(orderPaymentLinkId({ qt_payment_link: 42 })).toBeNull()
    expect(orderPaymentLinkId(null)).toBeNull()
  })
})
