import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import { StockShortBadge } from "@/features/orders/components/stock-short-badge"
import { stockShortLines } from "@/features/orders/stock-short"
import { StockShortAlert } from "./stock-short-alert"

describe("a paid order placed short of stock (adr/0026 Ek 2026-11-06)", () => {
  it("reads the server's mark, keeping only whole lines", () => {
    expect(
      stockShortLines({
        stock_short: {
          lines: [
            { variant_id: "v1", title: "Chuby / Kahverengi", sku: null, quantity: 2, short: 1 },
            { title: "Bozuk", quantity: "1", short: 1 },
          ],
        },
      })
    ).toEqual([{ variant_id: "v1", title: "Chuby / Kahverengi", sku: null, quantity: 2, short: 1 }])
    expect(stockShortLines({ stock_short: "yes" })).toEqual([])
    expect(stockShortLines(null)).toEqual([])
  })

  it("names each short line and what the shop can do", () => {
    render(<StockShortAlert lines={[{ title: "Chuby / Kahverengi", quantity: 2, short: 1 }]} />)

    expect(screen.getByRole("alert")).toHaveTextContent(/Stok yetersiz/)
    expect(screen.getByText("Chuby / Kahverengi: 1 adet eksik (siparişte 2)")).toBeInTheDocument()
    expect(screen.getByText(/iptal edip ödemeyi iade edin/)).toBeInTheDocument()
  })

  it("shows the badge only with units short", () => {
    const { rerender } = render(<StockShortBadge units={2} />)
    expect(screen.getByText("Stok yetersiz (2 adet)")).toBeInTheDocument()

    rerender(<StockShortBadge units={0} />)
    expect(screen.queryByText(/Stok yetersiz/)).toBeNull()
    rerender(<StockShortBadge units={undefined} />)
    expect(screen.queryByText(/Stok yetersiz/)).toBeNull()
  })
})
