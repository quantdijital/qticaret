import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AiButton } from "./ai-button"

const sdkFetch = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const SERVICES = {
  services: [],
  tasks: [
    {
      id: "focus_keyword",
      capability: "text",
      mode: "sync",
      options: [],
      allowed: true,
      usable: ["deepseek"],
      preference: null,
    },
  ],
  flags: { own_keys: true },
}

const KEYWORDS = "keten gömlek\nyazlık keten gömlek\nbej keten gömlek"

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const netFetch = vi.fn()

function setup() {
  sdkFetch.mockResolvedValue(SERVICES)
  const onUse = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AiButton
        task="focus_keyword"
        entity={{ type: "category", id: "pcat_1" }}
        onUse={onUse}
        choices
      />
    </QueryClientProvider>
  )
  return { onUse, user: userEvent.setup() }
}

beforeEach(() => {
  netFetch.mockReset()
  vi.stubGlobal("fetch", netFetch)
  netFetch.mockImplementation((url: string) =>
    json(url.endsWith("/accept") ? 200 : 201, {
      suggestion: {
        id: "sug_1",
        task: "focus_keyword",
        service: "deepseek",
        status: url.endsWith("/accept") ? "accepted" : "draft",
        text: KEYWORDS,
        problems: [],
        alternatives: [],
      },
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A suggestion of several lines, each a choice of its own (the focus keyword and its alternatives). */
describe("AiButton with choices", () => {
  it("lists each line with its own Kullan, the main one first, and no shared Kullan", async () => {
    const { user } = setup()
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))

    const list = await screen.findByRole("list", { name: "Öneriler" })
    const rows = within(list).getAllByRole("listitem")
    expect(rows.map((row) => row.textContent)).toEqual([
      "keten gömlekana öneriKullan",
      "yazlık keten gömlekKullan",
      "bej keten gömlekKullan",
    ])
    expect(screen.queryByRole("button", { name: "Kullan" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Kullan: bej keten gömlek" })).toBeInTheDocument()
  })

  it("hands the picked line to the form and records the decision, writing no record", async () => {
    const { onUse, user } = setup()
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    await user.click(await screen.findByRole("button", { name: "Kullan: yazlık keten gömlek" }))

    await waitFor(() => {
      expect(onUse).toHaveBeenCalledWith("yazlık keten gömlek")
    })
    expect(netFetch.mock.calls.map(([url]) => String(url))).toEqual([
      "/admin/ai/suggestions",
      "/admin/ai/suggestions/sug_1/accept",
    ])
    expect(JSON.parse((netFetch.mock.calls[0]?.[1] as { body: string }).body)).toEqual({
      task: "focus_keyword",
      entity_type: "category",
      entity_id: "pcat_1",
    })
    expect(screen.queryByRole("list", { name: "Öneriler" })).not.toBeInTheDocument()
  })
})
