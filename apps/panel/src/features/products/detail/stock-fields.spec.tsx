import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import { StockFields } from "./stock-fields"
import type { StockFacts, VariantValues } from "./variant-values"

const VALUES: VariantValues = {
  price: "249,00",
  stock: "3",
  backorder: false,
  tracked: true,
  cost: "",
  sku: "",
  gtin: "",
  mpn: "",
  weight: "",
  length: "",
  width: "",
  height: "",
  applyAll: false,
  images: [],
}

function Harness({ tracked, location = "sloc_1" }: { tracked: boolean; location?: string | null }) {
  const form = useForm<VariantValues>({ defaultValues: { ...VALUES, tracked } })
  const stock: StockFacts = { tracked, reserved: 0, backorder: false }
  return (
    <>
      <StockFields
        form={form}
        idPrefix="t"
        stock={stock}
        locationId={location}
        preorder={false}
        preorderOn={false}
      />
      {/* What the page's save bar sees */}
      <output data-testid="dirty">{Object.keys(form.formState.dirtyFields).join(",")}</output>
    </>
  )
}

const trackSwitch = () => screen.getByRole("switch", { name: "Stok takibi" })

describe("StockFields: stock tracking", () => {
  it("turns an untracked variant's tracking on and shows the count to fill", async () => {
    const user = userEvent.setup()
    render(<Harness tracked={false} />)
    expect(screen.getByText("Stok takibi yok: bu varyant her zaman satılır.")).toBeInTheDocument()
    expect(screen.queryByLabelText("Stok adedi")).toBeNull()

    await user.click(trackSwitch())
    expect(trackSwitch()).toBeChecked()
    expect(screen.getByLabelText("Stok adedi")).toHaveValue("3")
    expect(screen.getByTestId("dirty")).toHaveTextContent("tracked")
  })

  it("asks in place before turning a saved tracking off, and keeps it on when cancelled", async () => {
    const user = userEvent.setup()
    render(<Harness tracked />)
    await user.click(trackSwitch())
    expect(trackSwitch()).toBeChecked()
    expect(screen.getByText(/Stok takibi kapatılsın mı\?/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Vazgeç" }))
    expect(trackSwitch()).toBeChecked()
    expect(screen.queryByText(/Stok takibi kapatılsın mı\?/)).toBeNull()

    await user.click(trackSwitch())
    await user.click(screen.getByRole("button", { name: "Takibi kapat" }))
    expect(trackSwitch()).not.toBeChecked()
    expect(screen.queryByLabelText("Stok adedi")).toBeNull()
  })

  it("cannot be turned on without a default location", () => {
    render(<Harness tracked={false} location={null} />)
    expect(trackSwitch()).toBeDisabled()
  })
})
