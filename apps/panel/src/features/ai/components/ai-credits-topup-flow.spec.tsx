import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { PACK, wallet } from "@/features/settings/components/ai-credits.fixtures"
import { AiButton } from "./ai-button"

/**
 * "Kredi yükle" asked from the AI button inside a form of its own (a
 * review's reply, a picture's details): the request goes, once, and the
 * form around the button is never sent with it (#381 review, C1).
 */

const sdkFetch = vi.hoisted(() => vi.fn())
const staff = vi.hoisted(() => ({ role: "owner" }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: () => true,
  useStaff: () => staff,
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const ORDERS = "/admin/ai/credits/orders"
const ORDER = {
  order: {
    id: "aicord_01",
    pack_id: PACK.id,
    credits: 500,
    amount: 25_000,
    currency: "TRY",
    status: "pending",
    requested_at: "2026-11-25T10:00:00.000Z",
  },
}

const netFetch = vi.fn()
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const services = {
  services: [],
  tasks: [
    {
      id: "seo_title",
      capability: "text",
      mode: "sync",
      options: [],
      allowed: true,
      usable: ["platform"],
      preference: null,
    },
  ],
  flags: { own_keys: true },
}

function setup() {
  sdkFetch.mockImplementation((url: string) =>
    Promise.resolve(url === "/admin/ai/credits" ? wallet() : services)
  )
  netFetch.mockImplementation((url: string) =>
    url === ORDERS
      ? json(201, ORDER)
      : json(402, { type: "error", message: "ai.credits_exhausted" })
  )
  const outer = vi.fn((event: { preventDefault: () => void }) => {
    event.preventDefault()
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <form onSubmit={outer}>
        <AiButton task="seo_title" entity={{ type: "product", id: "prod_1" }} onUse={vi.fn()} />
      </form>
    </QueryClientProvider>
  )
  return { outer, client, user: userEvent.setup() }
}

const orderCalls = () => netFetch.mock.calls.filter(([url]) => url === ORDERS)

beforeEach(() => {
  staff.role = "owner"
  sdkFetch.mockReset()
  netFetch.mockReset()
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Kredi yükle from the AI button inside a form", () => {
  it("sends the request once and never the form around the button", async () => {
    const { outer, user } = setup()
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    expect(await screen.findByText("Krediniz bitti.")).toBeInTheDocument()
    const topUp = screen.getByRole("button", { name: "Kredi yükle" })
    // A plain button: the default (submit) would send the form around it
    expect(topUp).toHaveAttribute("type", "button")
    await user.click(topUp)
    const dialog = await screen.findByRole("dialog", { name: "Kredi yükle" })
    expect(dialog).toBeInTheDocument()
    await screen.findByRole("radio")
    await user.click(screen.getByRole("button", { name: "Talep gönder" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Kredi yükle" })).toBeNull()
    })
    expect(orderCalls()).toHaveLength(1)
    expect(outer).not.toHaveBeenCalled()
  })
})
