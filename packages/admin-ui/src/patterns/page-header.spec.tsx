import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PageHeader } from "./page-header"

// jsdom has no layout: the wide-actions case is checked in the browser (panel at
// 768 px, Siparişler); this pins the classes that make it work.
describe("PageHeader", () => {
  it("lets a wide action group wrap under the title instead of squeezing it", () => {
    render(
      <PageHeader
        title="Siparişler"
        description="Gelen siparişler"
        action={
          <span>
            <button type="button">Birinci</button>
            <button type="button">İkinci</button>
          </span>
        }
      />
    )

    const title = screen.getByRole("heading", { level: 1, name: "Siparişler" })
    const titleBlock = title.parentElement?.parentElement
    const row = titleBlock?.parentElement
    const actions = screen.getByRole("button", { name: "Birinci" }).parentElement?.parentElement

    // The row wraps; the title keeps a floor of its own, the actions never outgrow the row
    expect(row).toHaveClass("sm:flex-wrap")
    expect(titleBlock).toHaveClass("min-w-0", "sm:flex-[1_1_5.5rem]")
    expect(actions).toHaveClass("max-w-full", "flex-wrap")
  })

  it("renders no action wrapper when there is no action", () => {
    render(<PageHeader title="Stok" />)

    const row = screen.getByRole("heading", { level: 1, name: "Stok" }).parentElement?.parentElement
      ?.parentElement
    expect(row?.children).toHaveLength(1)
  })
})
