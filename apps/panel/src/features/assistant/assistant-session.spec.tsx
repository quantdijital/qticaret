import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { CommandMenu } from "@/components/layout/command-menu"
import { CURRENT_USER_KEY } from "@/features/auth/api/me"
import { STAFF_KEY } from "@/features/auth/api/staff"
import { featuresQuery } from "@/features/settings/api/features"
import { AssistantButton } from "./assistant-button"
import { AssistantProvider } from "./assistant-context"
import { AssistantPanel } from "./assistant-panel"

/*
 * Review of PR #322: a conversation is its asker's alone (O1), and ⌘K's
 * "Yardımcıya sor" sends nothing by itself (O2).
 */

const KEY = "qt.assistant.session"
const CONVERSATION = `aiconv_${"b".repeat(32)}`

const sdkFetch = vi.hoisted(() => vi.fn())
const location = vi.hoisted(() => ({ pathname: "/orders", search: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(() => Promise.resolve()),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) => select({ location }),
}))

const fetchMock = vi.fn()

const kept = (userId: string, text: string) =>
  JSON.stringify({ userId, conversationId: CONVERSATION, messages: [{ role: "user", text }] })

function renderShell(userId: string, withMenu = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(CURRENT_USER_KEY, { id: userId })
  client.setQueryData(STAFF_KEY, { user_id: userId, role: "owner", can: {} })
  client.setQueryData(featuresQuery().queryKey, [
    { key: "ai.assistant", default: false, owner: "tenant", enabled: true },
  ])
  render(
    <QueryClientProvider client={client}>
      <AssistantProvider>
        <AssistantButton />
        <AssistantPanel />
        {withMenu ? <Menu /> : null}
      </AssistantProvider>
    </QueryClientProvider>
  )
  return client
}

// Open at first; closes as the shell's does, so the dialog no longer hides the page
function Menu() {
  const [open, setOpen] = useState(true)
  return <CommandMenu open={open} onOpenChange={setOpen} />
}

const openPanel = () => userEvent.setup().click(screen.getByRole("button", { name: "Yardımcı" }))

beforeEach(() => {
  window.sessionStorage.clear()
  fetchMock.mockReset()
  sdkFetch.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("the tab's conversation belongs to its asker (O1)", () => {
  it("shows the signed-in member their own conversation", async () => {
    window.sessionStorage.setItem(KEY, kept("user_a", "benim sorum"))
    renderShell("user_a")
    await openPanel()
    expect(screen.getByText("benim sorum")).toBeInTheDocument()
  })

  it("never loads another member's conversation, and drops it", async () => {
    window.sessionStorage.setItem(KEY, kept("user_a", "A'nın sorusu"))
    renderShell("user_b")
    await openPanel()
    expect(screen.queryByText("A'nın sorusu")).toBeNull()
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it("drops a conversation kept without its owner (before this review)", async () => {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ conversationId: CONVERSATION, messages: [{ role: "user", text: "eski" }] })
    )
    renderShell("user_b")
    await openPanel()
    expect(screen.queryByText("eski")).toBeNull()
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it("starts afresh, closed, when another member signs in in the tab", async () => {
    window.sessionStorage.setItem(KEY, kept("user_a", "A'nın sorusu"))
    const client = renderShell("user_a")
    await openPanel()
    expect(screen.getByText("A'nın sorusu")).toBeInTheDocument()

    act(() => {
      client.setQueryData(CURRENT_USER_KEY, { id: "user_b" })
    })

    // The query's observers hear of it a tick later
    await waitFor(() => {
      expect(screen.queryByRole("complementary")).toBeNull()
    })
    await openPanel()
    expect(screen.queryByText("A'nın sorusu")).toBeNull()
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })
})

describe("⌘K's 'Yardımcıya sor' (O2)", () => {
  it("puts the words in the panel's box under its warning, and sends nothing", async () => {
    sdkFetch.mockResolvedValue({ orders: [], customers: [], products: [], parcels: [] })
    renderShell("user_a", true)
    const user = userEvent.setup()
    await user.type(screen.getByRole("combobox"), "Ayşe Yılmaz")
    const item = await screen.findByRole("option", { name: "Yardımcıya sor: Ayşe Yılmaz" })
    await waitFor(() => {
      expect(item).toHaveAttribute("aria-disabled", "false")
    })

    await user.click(item)

    expect(screen.getByRole("textbox", { name: "Ne yapmak istiyorsunuz?" })).toHaveValue(
      "Ayşe Yılmaz"
    )
    expect(screen.getByText(/kişisel bilgi yazmayın/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
