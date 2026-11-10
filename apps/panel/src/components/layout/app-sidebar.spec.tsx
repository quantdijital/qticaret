import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Package } from "lucide-react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SidebarMenu, SidebarProvider, useSidebar } from "@qticaret/admin-ui/ui/sidebar"
import { NavLink } from "./app-sidebar"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...rest }: ComponentProps<"a"> & { to: string }) => (
    <a
      href={to}
      {...rest}
      onClick={(event) => {
        // A test's DOM does not navigate; the menu's own handler runs
        event.preventDefault()
        rest.onClick?.(event)
      }}
    />
  ),
  useRouterState: () => "/",
}))

/** The drawer's state, and a way to open it as the top bar's button does on a phone. */
function DrawerProbe() {
  const { openMobile, setOpenMobile } = useSidebar()
  return (
    <button
      type="button"
      onClick={() => {
        setOpenMobile(true)
      }}
    >
      {openMobile ? "drawer open" : "drawer closed"}
    </button>
  )
}

describe("the menu on a phone (a drawer)", () => {
  it("closes once an item is chosen, so the page it opens shows", async () => {
    render(
      <SidebarProvider>
        <DrawerProbe />
        <SidebarMenu>
          <NavLink item={{ key: "products", to: "/products", icon: Package }} active={false} />
        </SidebarMenu>
      </SidebarProvider>
    )

    await userEvent.click(screen.getByRole("button", { name: "drawer closed" }))
    expect(screen.getByRole("button", { name: "drawer open" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("link", { name: "Ürünler" }))

    expect(screen.getByRole("button", { name: "drawer closed" })).toBeInTheDocument()
  })
})
