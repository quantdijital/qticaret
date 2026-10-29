import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import { OrderShipping } from "./shipping-badge"

describe("OrderShipping", () => {
  it("says before shipping whether the chosen option prints a label", () => {
    render(
      <OrderShipping
        order={{ shipping: null, delivery: { name: "Aras Kargo", carrier: "aras", pickup: false } }}
      />
    )

    expect(screen.getByText("Aras Kargo")).toBeInTheDocument()
    expect(screen.getByText("Etiket kargoya verince çıkar")).toBeInTheDocument()
  })

  it("names the shop's own delivery as one without a label", () => {
    render(
      <OrderShipping
        order={{
          shipping: null,
          delivery: { name: "Standart Kargo", carrier: null, pickup: false },
        }}
      />
    )

    expect(screen.getByText("Kendi gönderiniz, etiketsiz")).toBeInTheDocument()
  })

  it("shows the parcel's state once it has one", () => {
    render(
      <OrderShipping
        order={{
          shipping: { status: "created", tracking_number: null, fulfillment_id: "ful_1" },
          delivery: { name: "Aras Kargo", carrier: "aras", pickup: false },
        }}
      />
    )

    expect(screen.getByText("Etiket hazır")).toBeInTheDocument()
  })
})
