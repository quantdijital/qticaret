import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { GoogleReviewRow } from "@/features/reviews/api/google-reviews"
import { GoogleReviewDialog } from "./google-review-dialog"

const fetchMock = vi.hoisted(() => vi.fn())
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: toastMock }))

const review = (more: Partial<GoogleReviewRow> = {}): GoogleReviewRow => ({
  id: "grev_1",
  author: "Mehmet Kaya",
  rating: 5,
  comment: "Şam çeliği av bıçağı aldım.",
  created_at: "2026-11-02T10:00:00Z",
  replied: false,
  reply: null,
  replied_at: null,
  reply_state: null,
  hidden: false,
  hidden_reason: null,
  hidden_by: null,
  hidden_at: null,
  ...more,
})

const REPLIED = {
  replied: true,
  reply: "Teşekkür ederiz.",
  replied_at: "2026-11-02T18:00:00Z",
  reply_state: "approved" as const,
}

function open(row: GoogleReviewRow, handlers: Partial<Record<string, () => void>> = {}) {
  const onClose = vi.fn()
  const onHide = vi.fn()
  const onRestore = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <GoogleReviewDialog
        review={row}
        busy={false}
        onClose={handlers["onClose"] ?? onClose}
        onHide={onHide}
        onRestore={onRestore}
      />
    </QueryClientProvider>
  )
  return { onClose, onHide, onRestore, dialog: screen.getByRole("dialog") }
}

/** adr/0058 Ek 2026-11-06: replying to a Google review from its row's dialog. */
describe("GoogleReviewDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({})
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  it('shows the review whole and sends a first reply with "Yanıtla"', async () => {
    const { dialog, onClose } = open(review())

    expect(within(dialog).getByText("Mehmet Kaya yorumu")).toBeInTheDocument()
    expect(within(dialog).getByText("Şam çeliği av bıçağı aldım.")).toBeInTheDocument()
    const send = within(dialog).getByRole("button", { name: "Yanıtla" })
    expect(send).toBeDisabled()
    expect(within(dialog).queryByRole("button", { name: "Yanıtı sil" })).not.toBeInTheDocument()

    await userEvent.type(
      within(dialog).getByLabelText("Yanıtınız"),
      "  Teşekkürler, iyi günlerde!  "
    )
    await userEvent.click(send)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/google/reviews/items/grev_1/reply", {
        method: "POST",
        body: { comment: "Teşekkürler, iyi günlerde!" },
      })
    })
    expect(toastMock.success).toHaveBeenCalledWith("Yanıt Google'a gönderildi.")
    expect(onClose).toHaveBeenCalled()
  })

  it('updates a reply with "Yanıtı güncelle", lit only once the text changed', async () => {
    const { dialog } = open(review(REPLIED))
    const field = within(dialog).getByLabelText("Yanıtınız")
    const update = within(dialog).getByRole("button", { name: "Yanıtı güncelle" })

    expect(field).toHaveValue("Teşekkür ederiz.")
    expect(update).toBeDisabled()
    await userEvent.type(field, " Yine bekleriz.")
    await userEvent.click(update)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/google/reviews/items/grev_1/reply", {
        method: "POST",
        body: { comment: "Teşekkür ederiz. Yine bekleriz." },
      })
    })
    expect(toastMock.success).toHaveBeenCalledWith("Yanıt Google'da güncellendi.")
  })

  it("deletes a reply after asking", async () => {
    const { dialog } = open(review(REPLIED))

    await userEvent.click(within(dialog).getByRole("button", { name: "Yanıtı sil" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(within(confirm).getByText("Yanıt silinsin mi?")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    await userEvent.click(within(confirm).getByRole("button", { name: "Sil" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/google/reviews/items/grev_1/reply", {
        method: "DELETE",
      })
    })
    expect(toastMock.success).toHaveBeenCalledWith("Yanıt Google'dan silindi.")
  })

  it("counts bytes as Google does and holds a reply over 4096 of them", async () => {
    const { dialog } = open(review())
    const field = within(dialog).getByLabelText("Yanıtınız")

    await userEvent.click(field)
    await userEvent.paste("ş".repeat(2049))

    expect(within(dialog).getByText("4098 / 4096 bayt")).toBeInTheDocument()
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/en çok 4096 bayt/)
    expect(within(dialog).getByRole("button", { name: "Yanıtla" })).toBeDisabled()
  })

  it("says when Google still moderates the reply or did not publish it", () => {
    const pending = open(review({ ...REPLIED, reply_state: "pending" }))
    expect(within(pending.dialog).getByText("Google onayında")).toBeInTheDocument()
    expect(within(pending.dialog).getByText(/onaylayınca vitrinde de görünür/)).toBeInTheDocument()
  })

  it("shows Google's refusal in the shop's words and stays open", async () => {
    fetchMock.mockRejectedValueOnce({
      status: 400,
      message:
        "Bağlı Google hesabının bu işletmenin yorumlarını yanıtlama yetkisi yok; profilin sahibi ya da yöneticisi olan hesabı bağlayın.",
    })
    const { dialog, onClose } = open(review())

    await userEvent.type(within(dialog).getByLabelText("Yanıtınız"), "Teşekkürler")
    await userEvent.click(within(dialog).getByRole("button", { name: "Yanıtla" }))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("yanıtlama yetkisi yok"))
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it("takes the review off the storefront or puts it back from the same dialog", async () => {
    const shown = open(review())
    await userEvent.click(
      within(shown.dialog).getByRole("button", { name: "Mehmet Kaya yorumunu vitrinden kaldır" })
    )
    const ask = await screen.findByRole("dialog", { name: "Yorum vitrinden kaldırılsın mı?" })
    await userEvent.click(within(ask).getByText("Konu dışı ya da spam"))
    await userEvent.click(within(ask).getByRole("button", { name: "Vitrinden kaldır" }))

    expect(shown.onHide).toHaveBeenCalledWith("off_topic")
  })
})
