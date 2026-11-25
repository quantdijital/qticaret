import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReviewRow } from "@/features/reviews/api/reviews"
import { ReviewDialog } from "@/features/reviews/components/review-dialog"
import { wallet } from "@/features/settings/components/ai-credits.fixtures"

/**
 * A top-up asked from the reply's draft button, the credits run out: the
 * request goes and the reply typed in the box is not published with it
 * (#381 review, C1).
 */

const sdkFetch = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: () => true,
  useStaff: () => ({ role: "owner" }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const ORDERS = "/admin/ai/credits/orders"

const REVIEW: ReviewRow = {
  id: "prev_1",
  rating: 2,
  title: null,
  body: "Dikişi ilk yıkamada söküldü.",
  author_name: "Ali V.",
  customer_id: "cus_1",
  order_id: "order_1",
  origin: "storefront",
  status: "approved",
  has_link: false,
  reject_reason: null,
  reply: null,
  replied_at: null,
  created_at: "2026-11-01T10:00:00.000Z",
  updated_at: "2026-11-01T10:00:00.000Z",
  product: { id: "prod_1", title: "Keten Gömlek", thumbnail: null },
  photos: [],
}

const services = {
  services: [],
  tasks: [
    {
      id: "review_reply",
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

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const netFetch = vi.fn()

const published = () =>
  sdkFetch.mock.calls.filter(([path]) => String(path).endsWith("/reply")).length

beforeEach(() => {
  sdkFetch.mockReset()
  sdkFetch.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/admin/ai/services" ? services : path === "/admin/ai/credits" ? wallet() : {}
    )
  )
  netFetch.mockReset()
  netFetch.mockImplementation((url: string) =>
    url === ORDERS
      ? json(201, {
          order: {
            id: "aicord_01",
            pack_id: "pack-500",
            credits: 500,
            amount: 25_000,
            currency: "TRY",
            status: "pending",
            requested_at: "2026-11-25T10:00:00.000Z",
          },
        })
      : json(402, { type: "error", message: "ai.credits_exhausted" })
  )
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ReviewDialog, credits topped up from the draft button", () => {
  it("sends the request and leaves the typed reply unpublished", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ReviewDialog review={REVIEW} onClose={vi.fn()} />
      </QueryClientProvider>
    )
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText("Yanıtınız"), "Teşekkürler, ilgileniyoruz.")
    await user.click(await screen.findByRole("button", { name: /Ali V\./ }))
    expect(await screen.findByText("Krediniz bitti.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Kredi yükle" }))
    await screen.findByRole("dialog", { name: "Kredi yükle" })
    await screen.findByRole("radio")
    await user.click(screen.getByRole("button", { name: "Talep gönder" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Kredi yükle" })).toBeNull()
    })
    expect(netFetch.mock.calls.filter(([url]) => url === ORDERS)).toHaveLength(1)
    expect(published()).toBe(0)
  })
})
