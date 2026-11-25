import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import { CommandMenu } from "./command-menu"
import { usePageCommands } from "./page-commands"
import type { PageCommand } from "./page-commands"

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))
vi.mock("@/features/auth/api/me", () => ({ useLogout: () => ({ mutate: vi.fn() }) }))

function ProductPage({ items }: { items: PageCommand[] }) {
  usePageCommands("Alana git", items)
  return null
}

function Shell({ items, page = true }: { items: PageCommand[]; page?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      {page ? <ProductPage items={items} /> : null}
      <CommandMenu open={open} onOpenChange={setOpen} />
    </>
  )
}

function renderShell(items: PageCommand[], page = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(STAFF_KEY, { user_id: "user_1", role: "owner", can: {} })
  const view = render(
    <QueryClientProvider client={client}>
      <Shell items={items} page={page} />
    </QueryClientProvider>
  )
  return {
    rerender: (next: boolean) => {
      view.rerender(
        <QueryClientProvider client={client}>
          <Shell items={items} page={next} />
        </QueryClientProvider>
      )
    },
  }
}

describe("the page's own lines in the command menu (⌘K)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ orders: [], customers: [], products: [], parcels: [] })
  })

  it("lists the page's places first and runs the one picked once the menu has closed", async () => {
    const seo = vi.fn()
    renderShell([
      { key: "part.seo", label: "Arama motoru görünümü", run: seo },
      { key: "field.price", label: "Fiyat ve stok", keywords: ["fiyat"], run: vi.fn() },
    ])
    const group = await screen.findByRole("group", { name: "Alana git" })
    expect(group).toBeInTheDocument()
    await userEvent.click(screen.getByRole("option", { name: "Arama motoru görünümü" }))
    await waitFor(() => {
      expect(seo).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("finds a field by another word for it", async () => {
    renderShell([
      { key: "part.seo", label: "Arama motoru görünümü", run: vi.fn() },
      { key: "field.price", label: "Fiyat ve stok", keywords: ["stok kodu"], run: vi.fn() },
    ])
    await userEvent.type(screen.getByRole("combobox"), "Fiyat")
    expect(await screen.findByRole("option", { name: "Fiyat ve stok" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Arama motoru görünümü" })).toBeNull()
  })

  it("offers nothing of a page once it is gone", async () => {
    const { rerender } = renderShell([{ key: "part.seo", label: "Özellikler", run: vi.fn() }])
    expect(await screen.findByRole("group", { name: "Alana git" })).toBeInTheDocument()
    rerender(false)
    expect(screen.queryByRole("group", { name: "Alana git" })).toBeNull()
  })
})
