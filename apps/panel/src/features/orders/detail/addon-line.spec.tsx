import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import { lineAddonsOf } from "@/features/orders/addon-lines"
import { AddonLineDetails } from "./addon-line"

// As the server writes it on the cart line, carried to the order line (adr/0052 §1)
const ADDONS = {
  items: [
    {
      addon_id: "ad_1",
      kind: "text",
      label: "Ürün üzerine yazı",
      value: "Ahmet & Ayşe  1923",
      amount: 35,
      non_withdrawable: true,
    },
    {
      addon_id: "ad_2",
      kind: "choice",
      label: "Kılıf",
      choice_id: "ch_1",
      choice_label: "Desenli Siyah",
      amount: 300,
      non_withdrawable: false,
    },
    { addon_id: "ad_3", kind: "choice", label: "Paket", choice_label: "Kutusuz", amount: 0 },
  ],
  base: 1000,
  non_withdrawable: true,
  max_quantity: 10,
}

describe("AddonLineDetails (adr/0052 §9)", () => {
  it("lists each pick with its price per unit, the typed text in full", () => {
    render(<AddonLineDetails metadata={{ qt_addons: ADDONS }} currency="try" />)
    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("Ürün üzerine yazı: Ahmet & Ayşe 1923 (+₺35,00)")
    // Spaces as typed: the text is for making the product
    expect(screen.getByText("Ahmet & Ayşe  1923", { normalizer: (text) => text })).toHaveClass(
      "whitespace-pre-wrap"
    )
    expect(items[1]).toHaveTextContent("Kılıf: Desenli Siyah (+₺300,00)")
    // A free pick has no price beside it
    expect(items[2]).toHaveTextContent(/^Paket: Kutusuz$/)
    expect(screen.getByText("Cayma dışı")).toBeInTheDocument()
  })

  it("has no badge for a line inside the right of withdrawal", () => {
    const items = [ADDONS.items[1]]
    render(
      <AddonLineDetails
        metadata={{ qt_addons: { ...ADDONS, items, non_withdrawable: false } }}
        currency="try"
      />
    )
    expect(screen.getByText("Desenli Siyah")).toBeInTheDocument()
    expect(screen.queryByText("Cayma dışı")).toBeNull()
  })

  it("shows nothing for a line without add-ons, or with them removed", () => {
    const { container } = render(
      <>
        <AddonLineDetails metadata={null} currency="try" />
        <AddonLineDetails metadata={{ qt_addons: "" }} currency="try" />
        <AddonLineDetails metadata={{ qt_addons: { items: [] } }} currency="try" />
      </>
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe("lineAddonsOf", () => {
  it("keeps an erased text as the server left it, and reads the badge from any pick", () => {
    expect(
      lineAddonsOf({
        qt_addons: {
          items: [
            { addon_id: "ad_1", kind: "text", label: "Yazı", value: "—", non_withdrawable: true },
            { label: "" },
            "bozuk",
          ],
        },
      })
    ).toEqual({
      items: [{ id: "ad_1", kind: "text", label: "Yazı", value: "—", amount: 0 }],
      nonWithdrawable: true,
    })
  })
})
