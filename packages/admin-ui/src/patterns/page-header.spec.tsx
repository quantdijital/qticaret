import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { PageHeader } from "./page-header"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

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
    expect(titleBlock).toHaveClass("min-w-0", "sm:flex-[1_1_18rem]")
    expect(actions).toHaveClass("max-w-full", "flex-wrap")
  })

  it("renders no action wrapper when there is no action", () => {
    render(<PageHeader title="Stok" />)

    const row = screen.getByRole("heading", { level: 1, name: "Stok" }).parentElement?.parentElement
      ?.parentElement
    expect(row?.children).toHaveLength(1)
  })

  it("held at the top, keeps its title to one line and gives its height to the page", () => {
    const { unmount } = render(<PageHeader title="Şef Bıçağı 20 cm" sticky />)

    const title = screen.getByRole("heading", { level: 1, name: "Şef Bıçağı 20 cm" })
    expect(title).toHaveClass("truncate")
    expect(title).toHaveAttribute("title", "Şef Bıçağı 20 cm")
    const header = title.closest("header")
    expect(header).toHaveClass("sticky", "top-[var(--layout-topbar-height)]", "bg-background")
    expect(document.documentElement.style.getPropertyValue("--page-header-height")).toMatch(/px$/)

    unmount()
    expect(document.documentElement.style.getPropertyValue("--page-header-height")).toBe("")
  })

  it("puts an inline way back before the title, named, with no line of its own", () => {
    render(
      <PageHeader
        title="Doğu Akdeniz Gemi Turu"
        back={{ to: "/products", label: "Ürünlere dön", inline: true }}
        sticky
      />
    )

    const back = screen.getByRole("link", { name: "Ürünlere dön" })
    const title = screen.getByRole("heading", { level: 1, name: "Doğu Akdeniz Gemi Turu" })
    // In the title's row, inside the held header: it stays in sight as the page scrolls
    expect(back.parentElement).toBe(title.parentElement)
    expect(back.closest("header")).toHaveAttribute("data-page-header-sticky")
    expect(back).toHaveTextContent("")
    expect(title).toHaveClass("truncate")
  })

  it("keeps the back link on its own line over the title by default", () => {
    render(<PageHeader title="Sipariş" back={{ to: "/orders", label: "Siparişler" }} sticky />)

    const back = screen.getByRole("link", { name: "Siparişler" })
    expect(back.closest("header")).toBeNull()
  })
})
