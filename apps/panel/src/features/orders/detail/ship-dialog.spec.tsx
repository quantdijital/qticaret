import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { OrderDetail } from "@/features/orders/api/orders"
import { ShipDialog } from "./ship-dialog"

const order = {
  display_id: 1042,
  items: [
    { id: "line_1", title: "Şef bıçağı", thumbnail: null },
    { id: "line_2", title: "Bileme taşı", thumbnail: null },
  ],
} as unknown as OrderDetail

function renderDialog(onConfirm = vi.fn(), packed = false) {
  render(
    <ShipDialog
      order={order}
      items={[
        { id: "line_1", quantity: 3 },
        { id: "line_2", quantity: 1 },
      ]}
      packed={packed}
      open
      busy={false}
      onOpenChange={vi.fn()}
      onConfirm={onConfirm}
    />
  )
  return onConfirm
}

const ship = () => screen.getByRole("button", { name: "Kargoya ver" })
const quantity = (name: string) => screen.getByLabelText(`${name} için gönderilecek adet`)

describe("ShipDialog (F7.10)", () => {
  it("ships all that is left by default", async () => {
    const onConfirm = renderDialog()

    await userEvent.click(ship())

    expect(onConfirm).toHaveBeenCalledWith(true, undefined)
  })

  it("ships fewer of a line, leaving out a line set to none", async () => {
    const onConfirm = renderDialog()

    fireEvent.change(quantity("Şef bıçağı"), { target: { value: "1" } })
    fireEvent.change(quantity("Bileme taşı"), { target: { value: "0" } })
    await userEvent.click(ship())

    expect(onConfirm).toHaveBeenCalledWith(true, [{ id: "line_1", quantity: 1 }])
  })

  it("ships nothing when every line is set to none, and never more than is left", () => {
    renderDialog()

    fireEvent.change(quantity("Şef bıçağı"), { target: { value: "9" } })
    expect(quantity("Şef bıçağı")).toHaveValue(3)
    fireEvent.change(quantity("Şef bıçağı"), { target: { value: "0" } })
    fireEvent.change(quantity("Bileme taşı"), { target: { value: "0" } })

    expect(ship()).toBeDisabled()
  })

  it("hands a packed parcel over whole", () => {
    renderDialog(vi.fn(), true)

    expect(screen.queryByLabelText(/gönderilecek adet/)).not.toBeInTheDocument()
  })
})
