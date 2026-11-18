import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReviewRow } from "@/features/reviews/api/reviews"
import { ReviewDialog } from "@/features/reviews/components/review-dialog"
import {
  ReviewSummaryButton,
  ReviewSummaryCard,
} from "@/features/reviews/components/review-summary"
import { AiReviewsCard } from "@/features/settings/components/ai-reviews-card"

/**
 * Aşama 9 in the panel: a reply drafted into the review's form (never
 * sent by itself), a product's reviews summed up as a suggestion on this
 * screen, both drawn only while `ai.reviews` lets the role ask, and the
 * switch for the flag under Settings › Yapay zekâ.
 */

const sdkFetch = vi.hoisted(() => vi.fn())
const can = vi.hoisted(() => ({ value: true }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => can.value }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const task = (id: string, allowed: boolean, usable: string[]) => ({
  id,
  capability: "text",
  mode: "sync",
  options: [],
  allowed,
  usable,
  preference: null,
})

const servicesWith = (allowed: boolean, usable = ["deepseek"]) => ({
  services: [],
  tasks: ["review_summary", "review_reply", "question_answer"].map((id) =>
    task(id, allowed, usable)
  ),
  flags: { own_keys: true },
})

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

const DRAFT = "Yaşadığınız sorun için özür dileriz; konuyla hemen ilgileneceğiz."

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const netFetch = vi.fn()

function answering(text: string, taskId: string) {
  netFetch.mockImplementation((url: string) =>
    url.endsWith("/accept")
      ? json(200, { suggestion: { id: "sug_1", text } })
      : json(201, {
          suggestion: {
            id: "sug_1",
            task: taskId,
            service: "deepseek",
            status: "draft",
            text,
            problems: [],
            alternatives: [],
          },
        })
  )
}

function renderWith(services: unknown, node: ReactNode) {
  sdkFetch.mockImplementation((path: string) =>
    Promise.resolve(path === "/admin/ai/services" ? services : {})
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
  return userEvent.setup()
}

const netCalls = () => netFetch.mock.calls.map(([url]) => String(url))
const bodyOf = (index: number) =>
  JSON.parse((netFetch.mock.calls[index]?.[1] as { body: string }).body) as Record<string, unknown>

beforeEach(() => {
  can.value = true
  sdkFetch.mockReset()
  netFetch.mockReset()
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("a reply drafted for a review (Aşama 9)", () => {
  it("fills the reply box and sends nothing until Yanıtla", async () => {
    answering(DRAFT, "review_reply")
    const user = renderWith(servicesWith(true), <ReviewDialog review={REVIEW} onClose={vi.fn()} />)

    await user.click(
      await screen.findByRole("button", { name: "Ali V. yorumu için yanıt taslağı" })
    )
    expect(await screen.findByText(/yazar adı ve iletişim bilgisi ayıklanarak/)).toBeInTheDocument()
    await user.click(await screen.findByRole("button", { name: "Kullan" }))

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Yanıt/ })).toHaveValue(DRAFT)
    })
    expect(bodyOf(0)).toEqual({ task: "review_reply", entity_type: "review", entity_id: "prev_1" })
    expect(netCalls()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/accept"])
    // The reply itself goes only with the form's own button
    expect(sdkFetch.mock.calls.map(([path]) => String(path))).not.toContain(
      "/admin/product-reviews/prev_1/reply"
    )
  })

  it("draws no button while the flag (or the role) leaves the task closed", async () => {
    renderWith(servicesWith(false), <ReviewDialog review={REVIEW} onClose={vi.fn()} />)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/services")
    })
    expect(screen.queryByRole("button", { name: /yanıt taslağı/ })).not.toBeInTheDocument()
  })

  it("says how to connect a service when none can do it, and asks nothing", async () => {
    const user = renderWith(
      servicesWith(true, []),
      <ReviewDialog review={REVIEW} onClose={vi.fn()} />
    )
    await user.click(
      await screen.findByRole("button", { name: "Ali V. yorumu için yanıt taslağı" })
    )
    expect(await screen.findByRole("link", { name: "Bağla" })).toBeInTheDocument()
    expect(netFetch).not.toHaveBeenCalled()
  })
})

describe("a product's reviews summed up (Aşama 9)", () => {
  it("shows the summary taken as a suggestion on this screen, saving nothing", async () => {
    const summary = "Genel olarak memnun.\nArtılar: kumaş\nEksiler: dikiş"
    answering(summary, "review_summary")
    const onSummary = vi.fn()
    const user = renderWith(
      servicesWith(true),
      <ReviewSummaryButton productId="prod_1" productTitle="Keten Gömlek" onSummary={onSummary} />
    )

    await user.click(await screen.findByRole("button", { name: "Keten Gömlek yorumlarını özetle" }))
    await user.click(await screen.findByRole("button", { name: "Kullan" }))

    await waitFor(() => {
      expect(onSummary).toHaveBeenCalledWith({
        productId: "prod_1",
        productTitle: "Keten Gömlek",
        text: summary,
      })
    })
    expect(bodyOf(0)).toEqual({
      task: "review_summary",
      entity_type: "product",
      entity_id: "prod_1",
    })
  })

  it("lays the summary out line by line with copy and close", async () => {
    const onClose = vi.fn()
    const user = renderWith(
      servicesWith(true),
      <ReviewSummaryCard
        summary={{ productId: "prod_1", productTitle: "Keten Gömlek", text: "Bir\nİki" }}
        onClose={onClose}
      />
    )
    expect(screen.getByRole("region", { name: "Keten Gömlek · yorum özeti" })).toBeInTheDocument()
    expect(screen.getByText("Bir")).toBeInTheDocument()
    expect(screen.getByText(/vitrinde gösterilmez/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Özeti kapat" }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe("the switch for AI on reviews (Settings › Yapay zekâ)", () => {
  const flagged = (enabled: boolean) => (path: string, init?: { method?: string }) =>
    Promise.resolve(
      path === "/admin/features"
        ? { features: [{ key: "ai.reviews", default: false, owner: "tenant", enabled }] }
        : init?.method === "POST"
          ? { feature: { key: "ai.reviews", enabled: true } }
          : {}
    )

  it("turns the shop's flag on, off by default", async () => {
    sdkFetch.mockImplementation(flagged(false))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <AiReviewsCard />
      </QueryClientProvider>
    )
    const toggle = await screen.findByRole("switch", { name: "Yorum ve sorularda yapay zekâ" })
    await waitFor(() => {
      expect(toggle).toBeEnabled()
    })
    expect(toggle).not.toBeChecked()
    expect(
      screen.getByRole("button", { name: "Bilgi: Yorum ve sorularda yapay zekâ" })
    ).toBeInTheDocument()
    await userEvent.setup().click(toggle)
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/features/ai.reviews", {
        method: "POST",
        body: { enabled: true },
      })
    })
  })

  it("leaves it to the owner and admins", async () => {
    can.value = false
    sdkFetch.mockImplementation(flagged(true))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <AiReviewsCard />
      </QueryClientProvider>
    )
    const toggle = await screen.findByRole("switch", { name: "Yorum ve sorularda yapay zekâ" })
    await waitFor(() => {
      expect(toggle).toBeChecked()
    })
    expect(toggle).toBeDisabled()
  })
})
