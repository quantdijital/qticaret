import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import type { LegalDetail } from "@/features/legal/api"
import { formatDateTime } from "@/lib/format"
import { LegalStateCard } from "./legal-state-card"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))

const BASE = "/admin/legal-documents/return_policy"
const body = { type: "doc", content: [{ type: "paragraph" }] }
const PUBLISHED = {
  id: "ldoc_1",
  version: 1,
  title: "İade politikası",
  updated_at: "2026-10-30T10:00:00Z",
  published_at: "2026-10-30T10:00:00Z",
  body,
}
const DRAFT = {
  id: "ldoc_2",
  version: 2,
  title: "İade politikası",
  updated_at: "2026-11-04T08:15:00Z",
  published_at: null,
  body,
}

const detailWith = (parts: Partial<Pick<LegalDetail, "published" | "draft">>): LegalDetail => ({
  kind: "return_policy",
  published: null,
  draft: null,
  history: [],
  ...parts,
})

function renderCard(detail: LegalDetail, { dirty = false, can = true } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(STAFF_KEY, {
    user_id: "user_1",
    role: can ? "owner" : "readonly",
    can: { legalTexts: can },
    mfa: { available: true, required: false, enabled: true, passed: true },
  })
  render(
    <QueryClientProvider client={client}>
      <LegalStateCard detail={detail} dirty={dirty} />
    </QueryClientProvider>
  )
}

const resetCall = (source: string) => [`${BASE}/draft/reset`, { method: "POST", body: { source } }]

describe("LegalStateCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({})
    vi.clearAllMocks()
  })

  it("shows the version in force and the draft, each with its number and date", () => {
    renderCard(detailWith({ published: PUBLISHED, draft: DRAFT }))

    const published = screen.getByRole("heading", { name: "Yayında" }).closest("div.border")
    const draft = screen.getByRole("heading", { name: "Taslak" }).closest("div.border")
    expect(published).not.toBeNull()
    expect(draft).not.toBeNull()
    expect(within(published as HTMLElement).getByText("v1")).toBeInTheDocument()
    expect(
      within(published as HTMLElement).getByText(
        `${formatDateTime(PUBLISHED.published_at)} tarihinde yayımlandı.`
      )
    ).toBeInTheDocument()
    expect(within(draft as HTMLElement).getByText("v2")).toBeInTheDocument()
    expect(
      within(draft as HTMLElement).getByText(`Son kayıt: ${formatDateTime(DRAFT.updated_at)}.`)
    ).toBeInTheDocument()
    // The editor holds the draft
    expect(within(draft as HTMLElement).getByText("Düzenleyicide")).toBeInTheDocument()
    expect(within(published as HTMLElement).queryByText("Düzenleyicide")).toBeNull()
  })

  it("says when nothing is published or no draft waits", () => {
    renderCard(detailWith({ draft: DRAFT }))
    expect(screen.getByText(/Henüz yayımlanmadı/)).toBeInTheDocument()

    renderCard(detailWith({ published: PUBLISHED }))
    expect(screen.getByText(/Taslak yok/)).toBeInTheDocument()
  })

  it("opens a draft from the published text at once when nothing would be lost", async () => {
    const user = userEvent.setup()
    renderCard(detailWith({ published: PUBLISHED }))

    await user.click(screen.getByRole("button", { name: "Yayındakini düzenle" }))

    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(...resetCall("published"))
    expect(toast.success).toHaveBeenCalledWith("Yayındaki metinden taslak açıldı.")
  })

  it("asks first when the editor holds unsaved changes, and does nothing when told not to", async () => {
    const user = userEvent.setup()
    renderCard(detailWith({ published: PUBLISHED }), { dirty: true })

    await user.click(screen.getByRole("button", { name: "Yayındakini düzenle" }))
    const dialog = screen.getByRole("alertdialog")
    expect(within(dialog).getByText(/kaydedilmemiş değişiklikleriniz var/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Vazgeç" }))
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Yayındakini düzenle" }))
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Yayındakini düzenle" })
    )
    expect(fetchMock).toHaveBeenCalledWith(...resetCall("published"))
  })

  it("asks before it drops the draft, saying the published text stays", async () => {
    const user = userEvent.setup()
    renderCard(detailWith({ published: PUBLISHED, draft: DRAFT }))

    // A draft is there: it is edited, not opened again from the published text
    expect(screen.queryByRole("button", { name: "Yayındakini düzenle" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Taslağı at" }))
    const dialog = screen.getByRole("alertdialog")
    expect(
      within(dialog).getByText("Taslak silinir; yayındaki metin olduğu gibi kalır.")
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Taslağı at" }))

    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/draft`, { method: "DELETE" })
    expect(toast.success).toHaveBeenCalledWith("Taslak atıldı.")
  })

  it("says what is left when the draft goes and nothing is published", async () => {
    const user = userEvent.setup()
    renderCard(detailWith({ draft: DRAFT }))

    await user.click(screen.getByRole("button", { name: "Taslağı at" }))

    expect(
      within(screen.getByRole("alertdialog")).getByText(/Bu metnin yayında sürümü yok/)
    ).toBeInTheDocument()
  })

  it("asks before the starter replaces a draft, naming the lawyer's note", async () => {
    const user = userEvent.setup()
    renderCard(detailWith({ published: PUBLISHED, draft: DRAFT }))

    await user.click(screen.getByRole("button", { name: "Başlangıç metninden başla" }))
    const dialog = screen.getByRole("alertdialog")
    expect(
      within(dialog).getByText(
        "Taslağınız silinir ve platformun başlangıç metni yüklenir; TASLAK notu avukat onayına kadar yayını engeller."
      )
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Başlangıç metninden başla" }))

    expect(fetchMock).toHaveBeenCalledWith(...resetCall("starter"))
    expect(toast.success).toHaveBeenCalledWith("Başlangıç metni taslak olarak yüklendi.")
  })

  it("loads the starter at once beside a published text with no draft", async () => {
    const user = userEvent.setup()
    renderCard(detailWith({ published: PUBLISHED }))

    await user.click(screen.getByRole("button", { name: "Başlangıç metninden başla" }))

    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(...resetCall("starter"))
  })

  it("shows the refusal's sentence when the server refuses", async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValue({ status: 409, message: "Bu metnin yayında sürümü yok." })
    renderCard(detailWith({ published: PUBLISHED }))

    await user.click(screen.getByRole("button", { name: "Yayındakini düzenle" }))

    expect(toast.error).toHaveBeenCalledWith("Bu metnin yayında sürümü yok.")
  })

  it("offers the draft's actions only to those who may write the texts", () => {
    renderCard(detailWith({ published: PUBLISHED, draft: DRAFT }), { can: false })

    expect(screen.getByText("v2")).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
  })
})
