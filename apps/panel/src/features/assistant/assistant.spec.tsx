import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { featuresQuery } from "@/features/settings/api/features"
import { AssistantButton } from "./assistant-button"
import { AssistantProvider } from "./assistant-context"
import { AssistantPanel } from "./assistant-panel"

const PRODUCT_ID = "prod_01JD3K5X7Y9Z0A1B2C3D4E5F6G"
const CONVERSATION = `aiconv_${"a".repeat(32)}`

const sdkFetch = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const location = vi.hoisted(() => ({ pathname: "/products/x", search: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) => select({ location }),
}))

const fetchMock = vi.fn()

const answer = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status < 400,
    status,
    statusText: "",
    json: () => Promise.resolve(body),
  })

const turn = (text: string, screens: { key: string; label: string }[] = []) => ({
  conversation_id: CONVERSATION,
  messages: [
    { role: "user", text: "sorum" },
    { role: "assistant", text, screens },
  ],
})

function renderAssistant(on = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(featuresQuery().queryKey, [
    { key: "ai.assistant", default: false, owner: "tenant", enabled: on },
  ])
  render(
    <QueryClientProvider client={client}>
      <AssistantProvider>
        <AssistantButton />
        <AssistantPanel />
      </AssistantProvider>
    </QueryClientProvider>
  )
}

async function ask(text: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Yardımcı" }))
  await user.type(screen.getByRole("textbox"), `${text}{Enter}`)
  return user
}

describe("the panel assistant", () => {
  beforeEach(() => {
    location.pathname = `/products/${PRODUCT_ID}`
    location.search = {}
    window.sessionStorage.clear()
    window.localStorage.clear()
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
    sdkFetch.mockReset()
    navigate.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("draws nothing and takes no key while the shop's flag is off", async () => {
    renderAssistant(false)
    expect(screen.queryByRole("button", { name: "Yardımcı" })).toBeNull()
    await userEvent.keyboard("{Control>}j{/Control}")
    expect(screen.queryByRole("complementary")).toBeNull()
  })

  it("opens and closes beside the page with ⌘J / Ctrl+J", async () => {
    renderAssistant()
    const user = userEvent.setup()
    await user.keyboard("{Control>}j{/Control}")
    const panel = screen.getByRole("complementary", { name: "Yardımcı" })
    // Three questions for the open screen while empty
    expect(within(panel).getAllByRole("button", { name: /\?$/ })).toHaveLength(3)
    await user.keyboard("{Meta>}j{/Meta}")
    expect(screen.queryByRole("complementary")).toBeNull()
  })

  it("sends the open screen and draws the reply as plain text, a chip only for its own screens", async () => {
    fetchMock.mockReturnValue(
      answer(
        200,
        turn(
          "**Kargo** ücretini [[settings.shipping.options]] ekranında, [[orders]] ve [[admin.secret]] değil. <img src=x onerror=alert(1)> [bak](https://kotu.example)",
          [{ key: "settings.shipping.options", label: "settings.shipping.tabs.options" }]
        )
      )
    )
    renderAssistant()
    const user = await ask("kargo ücreti")

    const panel = screen.getByRole("complementary")
    const chips = await within(panel).findAllByRole("button", { name: /^Götür: / })
    expect(chips).toHaveLength(1)
    expect(chips[0]).toHaveAccessibleName(/Kargo.*›/)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/admin/ai/assistant/turns")
    expect(JSON.parse(init.body as string)).toEqual({
      message: "kargo ücreti",
      screen: { key: "products", record: { type: "product", id: PRODUCT_ID } },
      locale: "tr",
    })

    // Markup and addresses stay the characters they are; a marker not in `screens` is dropped
    const log = within(panel).getByRole("log")
    expect(log).toHaveTextContent("**Kargo** ücretini")
    expect(log).toHaveTextContent("<img src=x onerror=alert(1)> [bak](https://kotu.example)")
    expect(log).not.toHaveTextContent("[[")
    expect(log).not.toHaveTextContent("admin.secret")
    expect(log).toHaveAttribute("aria-live", "polite")
    expect(panel.querySelector("img, a")).toBeNull()

    await user.click(within(panel).getByRole("button", { name: /^Götür: / }))
    expect(navigate).toHaveBeenCalledWith({ to: "/settings/shipping", search: { part: "options" } })
    expect(screen.getByRole("complementary")).toBeInTheDocument()
  })

  it("drops a marker of a known screen the reply did not name", async () => {
    fetchMock.mockReturnValue(answer(200, turn("Siparişler [[orders]] ekranında.")))
    renderAssistant()
    await ask("siparişler")
    const log = screen.getByRole("log")
    expect(await within(log).findByText("Siparişler ekranında.")).toBeInTheDocument()
    expect(within(log).queryByRole("button")).toBeNull()
  })

  it("starts a new chat: the server drops the conversation, the tab forgets it", async () => {
    fetchMock.mockReturnValue(answer(200, turn("Tamam.")))
    sdkFetch.mockResolvedValue({ id: CONVERSATION, deleted: true })
    renderAssistant()
    const user = await ask("merhaba")
    expect(await screen.findByText("Tamam.")).toBeInTheDocument()
    expect(window.sessionStorage.getItem("qt.assistant.session")).toContain(CONVERSATION)

    await user.click(screen.getByRole("button", { name: /Yeni sohbet/ }))

    expect(sdkFetch).toHaveBeenCalledWith(`/admin/ai/assistant/conversations/${CONVERSATION}`, {
      method: "DELETE",
    })
    expect(screen.queryByText("Tamam.")).toBeNull()
    expect(window.sessionStorage.getItem("qt.assistant.session")).toBeNull()
  })

  it("says a refusal in the panel's words and gives the words back", async () => {
    fetchMock.mockReturnValue(answer(400, { message: "ai.assistant_daily_limit" }))
    renderAssistant()
    await ask("kargo")
    expect(await screen.findByText(/bugünkü kullanım sınırına ulaşıldı/)).toBeInTheDocument()
    expect(screen.getByRole("textbox")).toHaveValue("kargo")
  })

  it("keeps its width without storage, and remembers a new one when it can", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied")
    })
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full")
    })
    renderAssistant()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Yardımcı" }))
    const handle = screen.getByRole("separator", { name: "Yardımcının genişliği" })
    expect(handle).toHaveAttribute("aria-valuenow", "384")
    act(() => {
      handle.focus()
    })
    await user.keyboard("{ArrowLeft}")
    expect(handle).toHaveAttribute("aria-valuenow", "400")
    expect(setItem).toHaveBeenCalledWith("qt.assistant.width", "400")
    await user.keyboard("{Home}")
    expect(handle).toHaveAttribute("aria-valuenow", "640")
  })

  it("is a full-screen dialog on a phone", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    )
    renderAssistant()
    await userEvent.setup().click(screen.getByRole("button", { name: "Yardımcı" }))
    expect(screen.getByRole("dialog", { name: "Yardımcı" })).toBeInTheDocument()
    expect(screen.queryByRole("complementary")).toBeNull()
  })
})
