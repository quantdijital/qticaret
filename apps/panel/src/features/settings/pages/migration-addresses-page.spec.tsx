import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { OldAddress } from "@/features/settings/api/migration-addresses"
import { AddressesCard } from "@/features/settings/components/migration/addresses-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const address = (changes: Partial<OldAddress>): OldAddress => ({
  id: "murl_1",
  address: "/eski-kampanya",
  origins: ["search_console"],
  clicks: 500,
  entity_type: null,
  decision: "auto",
  target: null,
  outcome: null,
  state: "not_found",
  action: "undecided",
  ...changes,
})

const answers: Record<string, unknown> = {
  "/admin/migrations": { runs: [] },
  "/admin/migrations/urls/summary": {
    summary: {
      total: 2,
      matched: 1,
      decided: 0,
      undecided: 1,
      unsupported: 0,
      top: { checked: 2, unanswered: [{ address: "/eski-kampanya", clicks: 500 }] },
      ready: false,
    },
  },
  "/admin/migrations/urls?filter=all&offset=0": {
    urls: [
      address({}),
      address({
        id: "murl_2",
        address: "/urun/dokum-tava",
        action: "covered",
        state: "redirected",
        location: "/urun/yeni",
      }),
    ],
    count: 2,
    limit: 50,
  },
}

const renderWith = (element: React.ReactNode) => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(answers[url] ?? {}))
  return render(<QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>)
}

describe("Settings > Migration > Old addresses", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("says the cutover is not ready and takes the owner's 301 for an address", async () => {
    renderWith(<AddressesCard />)
    expect(await screen.findByText("Alan adını bağlamaya henüz hazır değil")).toBeInTheDocument()
    expect(screen.getByText(/1 tanesi henüz yanıt vermiyor/)).toBeInTheDocument()
    const row = (await screen.findByText("/eski-kampanya")).closest("tr") as HTMLElement
    // An address that answers already takes no decision
    const covered = screen.getByText("/urun/dokum-tava").closest("tr") as HTMLElement
    expect(within(covered).queryByRole("combobox")).not.toBeInTheDocument()

    await userEvent.click(within(row).getByRole("combobox"))
    await userEvent.click(await screen.findByRole("option", { name: "Yönlendir (301)" }))
    await userEvent.type(within(row).getByRole("textbox"), "/urun/yeni")
    await userEvent.click(within(row).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/migrations/urls/murl_1/decision", {
        method: "POST",
        body: { decision: "redirect", target: "/urun/yeni" },
      })
    })
  })

  it("suggests the category URL style that keeps the old category addresses (adr/0017 Ek 2026-11-23)", async () => {
    const summary = (answers["/admin/migrations/urls/summary"] as { summary: object }).summary
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === "/admin/migrations/urls/summary"
          ? {
              summary: {
                ...summary,
                category_style: {
                  current: "prefixed",
                  total: 40,
                  kept: { prefixed: 0, nested: 40, flat: 12 },
                  suggested: "nested",
                },
              },
            }
          : (answers[url] ?? {})
      )
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AddressesCard />
      </QueryClientProvider>
    )

    expect(
      await screen.findByText(/40 kategori adresinden 40 tanesi “Öneksiz, üst kategorilerle”/)
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Adres biçimini aç" })).toHaveAttribute(
      "href",
      "/settings/seo"
    )
  })

  it("says nothing of the category URL style when the current one keeps the most", async () => {
    renderWith(<AddressesCard />)
    expect(await screen.findByText("Alan adını bağlamaya henüz hazır değil")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Adres biçimini aç" })).toBeNull()
  })
})
