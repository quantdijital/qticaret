import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import type { CustomerStats } from "@/features/customers/api/customers"
import { figureText } from "@/features/customers/figures"
import { CustomerFigures } from "./customer-figures"

const STATS: CustomerStats = {
  customer_id: "cus_1",
  orders: 3,
  spent: "1250.50",
  average: "416.83",
  last_order_at: "2026-11-20T10:00:00.000Z",
  city: "İzmir",
}

const NONE: CustomerStats = {
  customer_id: "cus_2",
  orders: 0,
  spent: "0.00",
  average: "0.00",
  last_order_at: null,
  city: null,
}

describe("customer figures", () => {
  it("reads a customer's numbers in lira and Turkish dates", () => {
    render(
      <CustomerFigures
        stats={STATS}
        currency="try"
        figures={["orders", "spent", "average", "lastOrder", "city"]}
      />
    )

    expect(screen.getByText("Toplam harcama")).toBeInTheDocument()
    expect(screen.getByText(figureText(STATS, "spent", "try"))).toBeInTheDocument()
    expect(figureText(STATS, "spent", "try")).toContain("1.250,50")
    expect(screen.getByText("İzmir")).toBeInTheDocument()
  })

  it("puts a dash for what a customer without orders does not have", () => {
    expect(figureText(NONE, "orders", "try")).toBe("0")
    expect(figureText(NONE, "average", "try")).toBe("—")
    expect(figureText(NONE, "lastOrder", "try")).toBe("—")
    expect(figureText(NONE, "city", "try")).toBe("—")
  })
})
