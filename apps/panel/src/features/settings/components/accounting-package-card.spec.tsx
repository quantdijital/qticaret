import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AccountingPackageCard } from "./accounting-package-card"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe("AccountingPackageCard", () => {
  it("lists the package's sheets, the gift cards' among them (adr/0025 Ek 2026-11-03)", () => {
    render(<AccountingPackageCard />)

    const sheets = screen.getAllByRole("listitem").map((item) => item.textContent)
    expect(sheets).toEqual([
      "Satışlar: sipariş başına, KDV oranına göre matrah ve KDV (hediye kartı satışları hariç)",
      "İadeler: yapılan iadeler, ödeme yöntemiyle",
      "Tahsilatlar: alınan ödemeler, ödeme yöntemiyle",
      "KDV özeti: oran başına matrah ve KDV",
      "Hediye kartları: sipariş başına satılan kart (avans) ve kullanılan kart, ay toplamıyla",
    ])
  })
})
