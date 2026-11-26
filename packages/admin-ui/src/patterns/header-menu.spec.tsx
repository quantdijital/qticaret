import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { DropdownMenuItem } from "../ui/dropdown-menu"
import { DataTable } from "./data-table"
import { HeaderMenu } from "./header-menu"

describe("HeaderMenu", () => {
  it("is one named button whose items open from it", async () => {
    const onSelect = vi.fn()
    render(
      <HeaderMenu size="sm">
        <DropdownMenuItem onSelect={onSelect}>İade talepleri</DropdownMenuItem>
      </HeaderMenu>
    )

    const button = screen.getByRole("button", { name: "Diğer işlemler" })
    expect(button).toHaveAttribute("title", "Diğer işlemler")
    expect(screen.queryByRole("menuitem")).toBeNull()
    await userEvent.click(button)
    await userEvent.click(await screen.findByRole("menuitem", { name: "İade talepleri" }))
    expect(onSelect).toHaveBeenCalledOnce()
  })
})

// jsdom has no layout: the browser check is e2e/layout-overflow; this pins the classes
describe("DataTable fill column", () => {
  it("lets the name column take what is left and cut its text short", () => {
    render(
      <DataTable
        rows={[{ id: "1", name: "Çok uzun bir ürün adı" }]}
        rowKey={(row) => row.id}
        empty={null}
        columns={[
          { key: "name", header: "Ad", fill: true, cell: (row) => row.name },
          { key: "id", header: "Kod", cell: (row) => row.id },
        ]}
      />
    )

    const [nameHead, codeHead] = screen.getAllByRole("columnheader")
    expect(nameHead).toHaveClass("w-full", "max-w-0", "min-w-48")
    expect(codeHead).not.toHaveClass("w-full")
    expect(screen.getByRole("cell", { name: "Çok uzun bir ürün adı" })).toHaveClass("max-w-0")
  })
})
