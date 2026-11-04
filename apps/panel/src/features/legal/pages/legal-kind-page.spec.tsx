import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import type { LegalDetail } from "@/features/legal/api"
import { LegalKindPage } from "./legal-kind-page"

const fetchMock = vi.hoisted(() => vi.fn())
const params = vi.hoisted(() => ({ kind: "distance_sales" }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))
vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({ useParams: () => params }),
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}))
// Leaving the page is the router's; its guard has its own tests
vi.mock("@/components/patterns/leave-guard", () => ({ LeaveGuard: () => null }))
// The editor itself is ProseMirror's; its own tests cover it
vi.mock("@/features/content/editor/rich-editor", () => ({
  RichEditor: ({ label }: { label: string }) => <div aria-label={label} />,
}))

const body = { type: "doc", content: [{ type: "paragraph" }] }
const STARTER = {
  starter: { title: "Mesafeli Satış Sözleşmesi", body },
  tokens: ["mağaza_unvanı", "alıcı_adı"],
}

function serve(document: LegalDetail) {
  fetchMock.mockImplementation((path: string, init?: { method?: string }) => {
    if (path.endsWith("/starter")) {
      return Promise.resolve(STARTER)
    }
    if (init?.method === "POST" || init?.method === "DELETE") {
      return Promise.resolve({})
    }
    return Promise.resolve({ document })
  })
}

function renderPage(can = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(STAFF_KEY, {
    user_id: "user_1",
    role: can ? "owner" : "operations",
    can: { legalTexts: can },
    mfa: { available: true, required: false, enabled: true, passed: true },
  })
  render(
    <QueryClientProvider client={client}>
      <LegalKindPage />
    </QueryClientProvider>
  )
}

const version = (n: number) => ({
  id: `ldoc_${String(n)}`,
  version: n,
  title: "Mesafeli Satış Sözleşmesi",
  updated_at: "2026-10-30T10:00:00Z",
  published_at: "2026-10-30T10:00:00Z",
})

describe("LegalKindPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.clearAllMocks()
  })

  it("starts a text that does not exist from the platform's starter", async () => {
    const user = userEvent.setup()
    serve({ kind: "distance_sales", published: null, draft: null, history: [] })
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Başlangıç taslağıyla başla" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/legal-documents/distance_sales/draft/reset", {
      method: "POST",
      body: { source: "starter" },
    })
  })

  it("starts a blank text under the starter's title", async () => {
    const user = userEvent.setup()
    serve({ kind: "distance_sales", published: null, draft: null, history: [] })
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Boş başla" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/legal-documents/distance_sales/draft", {
      method: "POST",
      body: { title: STARTER.starter.title, body },
    })
  })

  it("asks once before it publishes a draft, about what publishing does, not the note", async () => {
    const user = userEvent.setup()
    serve({
      kind: "distance_sales",
      published: { ...version(1), body },
      draft: { ...version(2), published_at: null, body },
      history: [{ ...version(1), status: "published", published_by: "user_1" }],
    })
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Yayımla" }))
    const dialog = screen.getByRole("alertdialog")
    expect(within(dialog).getByText(/Yayımlanan sürüm değiştirilemez/)).toBeInTheDocument()
    // The starter's note goes by itself when published: nothing to delete or remember
    expect(dialog.textContent).not.toMatch(/avukat|TASLAK|notu/i)
    await user.click(within(dialog).getByRole("button", { name: "Yayımla" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/legal-documents/distance_sales/publish", {
      method: "POST",
      body: {},
    })
    expect(screen.getByText("Yürürlükte")).toBeInTheDocument()
    // A contract lists the order's tokens beside the shop's
    expect(await screen.findByText("{alıcı_adı}")).toBeInTheDocument()
  })

  it("warns that the editor's unsaved changes go when the draft is dropped", async () => {
    const user = userEvent.setup()
    serve({
      kind: "distance_sales",
      published: { ...version(1), body },
      draft: { ...version(2), published_at: null, body },
      history: [{ ...version(1), status: "published", published_by: "user_1" }],
    })
    renderPage()

    await user.type(await screen.findByLabelText("Başlık"), " (yeni)")
    await user.click(screen.getByRole("button", { name: "Taslağı at" }))
    const dialog = screen.getByRole("alertdialog")
    expect(within(dialog).getByText(/kaydedilmemiş değişiklikleriniz var/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Taslağı at" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/legal-documents/distance_sales/draft", {
      method: "DELETE",
    })
  })

  it("leaves publishing and the draft's actions to those who may write the texts", async () => {
    serve({
      kind: "distance_sales",
      published: { ...version(1), body },
      draft: { ...version(2), published_at: null, body },
      history: [],
    })
    renderPage(false)

    expect(await screen.findByRole("heading", { name: "Taslak" })).toBeInTheDocument()
    for (const name of ["Önizle", "Yayımla", "Taslağı at", "Başlangıç metninden başla"]) {
      expect(screen.queryByRole("button", { name })).toBeNull()
    }
  })
})
