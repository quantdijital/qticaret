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

function renderDialog(
  onConfirm = vi.fn(),
  packed = false,
  rest: { id: string; quantity: number }[] = []
) {
  render(
    <ShipDialog
      order={order}
      items={
        packed
          ? [{ id: "line_1", quantity: 1 }]
          : [
              { id: "line_1", quantity: 3 },
              { id: "line_2", quantity: 1 },
            ]
      }
      rest={rest}
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

    expect(onConfirm).toHaveBeenCalledWith(true, { packed: false }, undefined)
  })

  it("ships fewer of a line, leaving out a line set to none", async () => {
    const onConfirm = renderDialog()

    fireEvent.change(quantity("Şef bıçağı"), { target: { value: "1" } })
    fireEvent.change(quantity("Bileme taşı"), { target: { value: "0" } })
    await userEvent.click(ship())

    expect(onConfirm).toHaveBeenCalledWith(
      true,
      { packed: false, items: [{ id: "line_1", quantity: 1 }] },
      undefined
    )
  })

  it("ships nothing when every line is set to none, and never more than is left", () => {
    renderDialog()

    fireEvent.change(quantity("Şef bıçağı"), { target: { value: "9" } })
    expect(quantity("Şef bıçağı")).toHaveValue(3)
    fireEvent.change(quantity("Şef bıçağı"), { target: { value: "0" } })
    fireEvent.change(quantity("Bileme taşı"), { target: { value: "0" } })

    expect(ship()).toBeDisabled()
  })

  it("hands a packed parcel over whole", async () => {
    const onConfirm = renderDialog(vi.fn(), true)

    expect(screen.queryByLabelText(/gönderilecek adet/)).not.toBeInTheDocument()
    await userEvent.click(ship())

    expect(onConfirm).toHaveBeenCalledWith(true, { packed: true }, undefined)
  })

  it("sends a packed parcel and the lines beside it together, or either alone (adr/0054 addendum)", async () => {
    const onConfirm = renderDialog(vi.fn(), true, [{ id: "line_2", quantity: 2 }])

    await userEvent.click(ship())
    expect(onConfirm).toHaveBeenLastCalledWith(
      true,
      { packed: true, items: [{ id: "line_2", quantity: 2 }] },
      undefined
    )

    // The others first, the packed parcel later
    await userEvent.click(screen.getByRole("checkbox", { name: "Paketlenmiş koli" }))
    await userEvent.click(ship())
    expect(onConfirm).toHaveBeenLastCalledWith(
      true,
      { packed: false, items: [{ id: "line_2", quantity: 2 }] },
      undefined
    )

    fireEvent.change(quantity("Bileme taşı"), { target: { value: "0" } })
    expect(ship()).toBeDisabled()
  })

  it("sends the shop's own parcel's tracking as typed, tidied, and holds a half-typed one back", async () => {
    const onConfirm = renderDialog()

    await userEvent.click(screen.getByText("Takip bilgisi (isteğe bağlı)"))
    await userEvent.type(screen.getByLabelText("Kargo firması"), "MNG Kargo")
    expect(ship()).toBeDisabled()
    expect(screen.getByText(/4–40 harf\/rakamlık/)).toBeInTheDocument()
    // Copied with spaces, a link without its https://: still the same number and page
    await userEvent.type(screen.getByLabelText("Takip numarası"), "MNG 123 456")
    await userEvent.type(screen.getByLabelText("Takip bağlantısı (https://…)"), "localhost")
    expect(ship()).toBeDisabled()
    await userEvent.clear(screen.getByLabelText("Takip bağlantısı (https://…)"))
    await userEvent.type(
      screen.getByLabelText("Takip bağlantısı (https://…)"),
      "http://kargotakip.example.com/?no=1"
    )
    await userEvent.click(ship())

    expect(onConfirm).toHaveBeenCalledWith(
      true,
      { packed: false },
      {
        carrier: "MNG Kargo",
        number: "MNG123456",
        url: "https://kargotakip.example.com/?no=1",
      }
    )
  })
})
