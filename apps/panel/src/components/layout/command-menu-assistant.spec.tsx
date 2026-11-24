import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { ASSISTANT_OFF, AssistantContext } from "@/features/assistant/assistant-state"
import { STAFF_KEY } from "@/features/auth/api/staff"
import { CommandMenu } from "./command-menu"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))
vi.mock("@/features/auth/api/me", () => ({ useLogout: () => ({ mutate: vi.fn() }) }))

function renderMenu(enabled: boolean) {
  const ask = vi.fn()
  const onOpenChange = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(STAFF_KEY, { user_id: "user_1", role: "owner", can: {} })
  render(
    <QueryClientProvider client={client}>
      <AssistantContext.Provider value={{ ...ASSISTANT_OFF, enabled, ask }}>
        <CommandMenu open onOpenChange={onOpenChange} />
      </AssistantContext.Provider>
    </QueryClientProvider>
  )
  return { ask, onOpenChange }
}

describe("CommandMenu's 'Yardımcıya sor' (adr/0079 §9)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ orders: [], customers: [], products: [], parcels: [] })
  })

  it("hands the typed words to the assistant, last in the list, and closes", async () => {
    const user = userEvent.setup()
    const { ask, onOpenChange } = renderMenu(true)
    await user.type(screen.getByRole("combobox"), "kargo ücreti")

    const item = await screen.findByRole("option", { name: "Yardımcıya sor: kargo ücreti" })
    expect(screen.getAllByRole("option").at(-1)).toBe(item)
    // Once the records' search has answered
    await waitFor(() => {
      expect(item).toHaveAttribute("aria-disabled", "false")
    })

    await user.click(item)
    expect(ask).toHaveBeenCalledWith("kargo ücreti")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("is not what Enter picks while the records are still being looked up (review O2)", async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined))
    const user = userEvent.setup()
    const { ask } = renderMenu(true)
    await user.type(screen.getByRole("combobox"), "Ayşe Yılmaz")
    const item = await screen.findByRole("option", { name: "Yardımcıya sor: Ayşe Yılmaz" })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    await user.keyboard("{Enter}")

    expect(item).toHaveAttribute("aria-disabled", "true")
    expect(ask).not.toHaveBeenCalled()
  })

  it("offers nothing of the assistant with the flag off or nothing typed", async () => {
    const user = userEvent.setup()
    renderMenu(false)
    await user.type(screen.getByRole("combobox"), "kargo")
    expect(screen.queryByText(/Yardımcıya sor/)).toBeNull()
  })
})
