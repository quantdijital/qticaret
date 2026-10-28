import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { QuestionRow } from "@/features/reviews/api/questions"
import { QuestionsPage } from "./questions-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  getRouteApi: () => ({ useSearch: () => ({}) }),
  useNavigate: () => vi.fn(),
}))

const question: QuestionRow = {
  id: "pq_1",
  body: "Bu tava indüksiyonda çalışır mı?",
  author_name: "Ayşe Y.",
  status: "approved",
  has_link: false,
  created_at: "2026-10-28T10:00:00Z",
  product: { id: "prod_1", title: "Döküm tava" },
  answers: [
    {
      id: "pans_1",
      body: "Bende çalışıyor.",
      author_name: "Ali V.",
      by_shop: false,
      status: "pending",
      has_link: false,
      created_at: "2026-10-28T11:00:00Z",
    },
  ],
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <QuestionsPage />
    </QueryClientProvider>
  )
}

describe("QuestionsPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/admin/product-questions" ? { questions: [question], count: 1 } : {}
      )
    )
  })

  it("approves a customer's answer waiting under a question", async () => {
    renderPage()
    const decide = await screen.findByRole("group", { name: "Ali V. cevabı için karar" })
    await userEvent.click(within(decide).getByRole("button", { name: "Onayla" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/product-answers/moderate", {
        method: "POST",
        body: { ids: ["pans_1"], status: "approved" },
      })
    })
    expect(screen.getByText("Onay bekliyor")).toBeInTheDocument()
  })

  it("answers in the shop's name once there are ten characters", async () => {
    renderPage()
    const box = await screen.findByRole("textbox", { name: "Mağaza adına cevap" })
    const send = screen.getByRole("button", { name: "Cevapla" })
    await userEvent.type(box, "Evet")
    expect(send).toBeDisabled()
    await userEvent.type(box, ", indüksiyona uygundur.")
    await userEvent.click(send)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/product-questions/pq_1/answer", {
        method: "POST",
        body: { body: "Evet, indüksiyona uygundur." },
      })
    })
  })
})
