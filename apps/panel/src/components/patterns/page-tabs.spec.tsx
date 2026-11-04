import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PageTabs } from "./page-tabs"

// The open tab, as the address holds it (`?part=`)
const search = vi.hoisted(() => ({ current: {} }))
const navigate = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => search.current,
  useNavigate: () => navigate,
}))

const TABS = [
  { key: "messages", label: "İletişim geçmişi", count: 4, content: <p>Dört ileti</p> },
  { key: "contracts", label: "Sözleşme onayı", content: <p>Onay kaydı</p> },
]

describe("PageTabs", () => {
  beforeEach(() => {
    navigate.mockClear()
    search.current = {}
  })

  it("opens the first tab for an unknown part, its count beside its name", () => {
    search.current = { part: "nothing" }
    render(<PageTabs tabs={TABS} label="Siparişin geçmişi" />)

    expect(screen.getByRole("tab", { name: "İletişim geçmişi 4" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByText("Dört ileti")).toBeVisible()
    // An inactive tab's card is not drawn
    expect(screen.queryByText("Onay kaydı")).toBeNull()
  })

  it("puts the chosen tab in the address without jumping to the top", async () => {
    render(<PageTabs tabs={TABS} label="Siparişin geçmişi" />)
    await userEvent.click(screen.getByRole("tab", { name: "Sözleşme onayı" }))

    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: ".", replace: true, resetScroll: false })
    )
  })

  it("keeps every tab's card alive while hidden when asked", () => {
    search.current = { part: "contracts" }
    render(<PageTabs tabs={TABS} label="Ürünün diğer bölümleri" keepMounted />)

    expect(screen.getByText("Onay kaydı")).toBeVisible()
    // Still there, unsaved edits and all, only out of sight
    expect(screen.getByText("Dört ileti").closest("[role=tabpanel]")).toHaveClass(
      "data-[state=inactive]:hidden"
    )
    expect(screen.getByText("Dört ileti").closest("[role=tabpanel]")).toHaveAttribute(
      "data-state",
      "inactive"
    )
  })
})
