import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ApiKeyRow } from "@/features/settings/api/api-access"
import { ApiKeyList } from "./api-key-list"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const key = (id: string, title: string, revoked_at: string | null): ApiKeyRow => ({
  id,
  title,
  redacted: "sk_abc***xyz",
  created_at: "2026-10-01T09:00:00Z",
  revoked_at,
  scopes: ["orders:read"],
})

const KEYS = [
  key("apk_1", "Depo programı", null),
  key("apk_2", "Eski muhasebe", "2026-10-20T09:00:00Z"),
  key("apk_3", "Eski depo", "2026-10-25T09:00:00Z"),
]

function show(keys: ApiKeyRow[] = KEYS) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApiKeyList keys={keys} />
    </QueryClientProvider>
  )
}

const row = (title: string) => {
  const item = screen.getByText(title).closest("li")
  if (!item) {
    throw new Error(`no row for ${title}`)
  }
  return within(item)
}

describe("ApiKeyList", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ id: "apk_3", deleted: true })
  })

  it("lists active keys first and folds the revoked ones under their count", async () => {
    show()

    const toggle = screen.getByRole("button", { name: "İptal edilenler (2)" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(row("Depo programı").getByRole("button", { name: "İptal et" })).toBeInTheDocument()
    expect(row("Depo programı").queryByRole("button", { name: "Sil" })).toBeNull()
    expect(screen.queryByText("Eski depo")).toBeNull()

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute("aria-expanded", "true")
    const titles = screen.getAllByRole("listitem").map((item) => item.textContent)
    expect(titles[0]).toContain("Depo programı")
    // Latest revoked first, each with its revocation date and a delete, no revoke
    expect(titles[1]).toContain("Eski depo")
    expect(titles[2]).toContain("Eski muhasebe")
    expect(row("Eski depo").getByText(/tarihinde iptal edildi/)).toBeInTheDocument()
    expect(row("Eski depo").getByRole("button", { name: "Sil" })).toBeInTheDocument()
    expect(row("Eski depo").queryByRole("button", { name: "İptal et" })).toBeNull()
  })

  it("asks before deleting for good, and deletes only once confirmed", async () => {
    show()
    await userEvent.click(screen.getByRole("button", { name: "İptal edilenler (2)" }))

    await userEvent.click(row("Eski depo").getByRole("button", { name: "Sil" }))
    const dialog = screen.getByRole("alertdialog")
    expect(within(dialog).getByText("Eski depo silinsin mi?")).toBeInTheDocument()
    expect(within(dialog).getByText(/kalıcı olarak silinir/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole("button", { name: "Sil" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/api-access/apk_3", { method: "DELETE" })
  })

  it("keeps nothing to delete when no key is revoked, and says when none is active", () => {
    show([key("apk_2", "Eski muhasebe", "2026-10-20T09:00:00Z")])

    expect(screen.getByText("Etkin anahtar yok.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "İptal edilenler (1)" })).toBeInTheDocument()

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ApiKeyList keys={[key("apk_1", "Depo programı", null)]} />
      </QueryClientProvider>
    )
    expect(screen.queryByRole("button", { name: /İptal edilenler \(0\)/ })).toBeNull()
    expect(screen.queryByRole("button", { name: "Sil" })).toBeNull()
  })
})
