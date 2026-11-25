import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AuditEntry, AuditSearch } from "@/features/settings/api/audit"
import { AuditPage } from "./audit-page"

const fetchMock = vi.hoisted(() => vi.fn())
const listUsers = vi.hoisted(() => vi.fn())
const search = vi.hoisted((): { current: AuditSearch } => ({ current: {} }))
// Who may read the log (adr/0040): the owner unless a test says otherwise
const staff = vi.hoisted(() => ({ audit: true }))

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { user: { list: listUsers } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: () => staff.audit,
  staffQuery: () => ({ queryKey: ["staff"], queryFn: () => Promise.resolve({ can: {} }) }),
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/settings/audit?part=jobs">{children}</a>
  ),
  getRouteApi: () => ({ useSearch: () => search.current }),
  // The tabs read the open one from the address
  useSearch: () => search.current,
  useNavigate: () => vi.fn(),
}))

const entry = (more: Partial<AuditEntry> = {}): AuditEntry => ({
  id: "aud_1",
  created_at: "2026-10-29T09:30:00Z",
  kind: "mutation",
  action: "POST /admin/products/:id",
  actor_type: "user",
  actor_id: "user_1",
  resource_type: "product",
  resource_id: "prod_1",
  outcome: 200,
  changes: {
    fields: ["title", "metadata"],
    diff: {
      title: { before: "Şef bıçağı", after: "Şef bıçağı 20 cm" },
      secret_note: { changed: true, after_last4: "7890" },
    },
  },
  request_id: "req_abc123",
  ip: "203.0.113.7",
  user_agent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  ...more,
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AuditPage />
    </QueryClientProvider>
  )
}

describe("AuditPage", () => {
  beforeEach(() => {
    search.current = {}
    staff.audit = true
    fetchMock.mockReset()
    fetchMock.mockImplementation((path: string) => {
      if (path === "/admin/audit-log/resource-types") {
        return Promise.resolve({ resource_types: ["customer", "product"] })
      }
      if (path === "/admin/staff") {
        return Promise.resolve({ staff: [], invites: null })
      }
      if (path === "/admin/async-jobs") {
        return Promise.resolve({ async_job: { id: "job_1" } })
      }
      return Promise.resolve({ audit_entries: [entry()], count: 1 })
    })
    listUsers.mockResolvedValue({
      users: [{ id: "user_1", email: "deniz@example.com", first_name: "Deniz", last_name: "Kaya" }],
    })
  })

  it("asks the log for what the address names: who, which kind of thing, which Turkish days", async () => {
    search.current = { actor: "api-key", resource: "product", from: "2026-10-01", to: "2026-10-29" }
    renderPage()

    await screen.findByText("POST /admin/products/:id")
    expect(fetchMock).toHaveBeenCalledWith("/admin/audit-log", {
      query: {
        limit: 50,
        offset: 0,
        actor_type: "api-key",
        resource_type: "product",
        created_after: "2026-09-30T21:00:00.000Z",
        created_before: "2026-10-29T20:59:59.999Z",
      },
    })
    // The address's filters as chips under the filter button
    expect(screen.getByRole("button", { name: "Filtrele · 3" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Tarih: / })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tümünü temizle" })).toBeInTheDocument()
  })

  it("opens an entry in full: who, outcome, request, browser and each field's change", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText("POST /admin/products/:id"))
    const sheet = await screen.findByRole("dialog")

    expect(within(sheet).getByText("Deniz Kaya")).toBeInTheDocument()
    expect(within(sheet).getByText("Başarılı (200)")).toBeInTheDocument()
    expect(within(sheet).getByText("req_abc123")).toBeInTheDocument()
    expect(within(sheet).getByText("Chrome 141 · macOS")).toBeInTheDocument()
    expect(within(sheet).getByText("Şef bıçağı 20 cm")).toBeInTheDocument()
    expect(within(sheet).getByText("Değişti (gizli alan, son 4: 7890)")).toBeInTheDocument()
  })

  it("exports what is shown, with the same filters", async () => {
    search.current = { kind: "mutation", actor: "user_1" }
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole("button", { name: "Süzülenleri CSV olarak dışa aktar" })
    )

    expect(fetchMock).toHaveBeenCalledWith("/admin/async-jobs", {
      method: "POST",
      body: { type: "audit_log.export", input: { kind: "mutation", actor_id: "user_1" } },
    })
  })

  it("opens on the log, with the long jobs as a tab beside it (the owner, 2026-11-23)", async () => {
    renderPage()

    await screen.findByText("POST /admin/products/:id")
    expect(screen.getByRole("tab", { name: "Denetim kaydı" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByRole("tab", { name: "İşler" })).toHaveAttribute("aria-selected", "false")
  })

  it("shows the jobs at ?part=jobs, without the log's export", async () => {
    search.current = { part: "jobs" }
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/admin/async-jobs"
          ? { async_jobs: [], count: 0 }
          : { audit_entries: [], count: 0 }
      )
    )
    renderPage()

    expect(screen.getByRole("tab", { name: "İşler" })).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByText(/Henüz iş yok/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /dışa aktar/i })).toBeNull()
  })

  it("tells a role without the log it may not, the jobs too (the owner, 2026-11-23)", async () => {
    staff.audit = false
    search.current = { part: "jobs" }
    renderPage()

    expect(screen.getByRole("heading", { name: "Denetim kaydı" })).toBeInTheDocument()
    expect(
      await screen.findByText(
        "Denetim kaydını ve işleri yalnız mağaza sahibi ve yöneticiler görebilir."
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole("tab")).toBeNull()
    expect(screen.queryByText(/Henüz iş yok/)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/audit-log", expect.anything())
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/async-jobs", expect.anything())
  })
})
