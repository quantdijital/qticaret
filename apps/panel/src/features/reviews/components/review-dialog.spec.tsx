import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReviewRow } from "@/features/reviews/api/reviews"
import { ReviewDialog } from "./review-dialog"

const fetchMock = vi.hoisted(() => vi.fn())
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: toastMock }))

const review = (more: Partial<ReviewRow> = {}): ReviewRow => ({
  id: "prev_1",
  rating: 4,
  title: "Keskin",
  body: "Çok keskin, sapı rahat.",
  author_name: "Ayşe Y.",
  customer_id: "cus_1",
  order_id: "order_1",
  origin: "storefront",
  status: "approved",
  has_link: false,
  reject_reason: null,
  reply: null,
  replied_at: null,
  created_at: "2026-10-28T10:00:00Z",
  updated_at: "2026-10-28T10:05:00Z",
  product: { id: "prod_1", title: "Şef bıçağı", thumbnail: null },
  photos: [],
  ...more,
})

const REPLIED = { reply: "Teşekkür ederiz.", replied_at: "2026-11-02T18:00:00Z" }

function open(row: ReviewRow) {
  const onClose = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ReviewDialog review={row} onClose={onClose} />
    </QueryClientProvider>
  )
  return { onClose, dialog: screen.getByRole("dialog") }
}

/** The shop's public reply under an approved review, from its row's dialog. */
describe("ReviewDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({})
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  it('shows the review whole and sends a first reply with "Yanıtla", trimmed', async () => {
    const { dialog, onClose } = open(review())

    expect(within(dialog).getByText("Ayşe Y. yorumu")).toBeInTheDocument()
    expect(within(dialog).getByText(/Şef bıçağı/)).toBeInTheDocument()
    expect(within(dialog).getByText("Çok keskin, sapı rahat.")).toBeInTheDocument()
    const send = within(dialog).getByRole("button", { name: "Yanıtla" })
    expect(send).toBeDisabled()
    expect(within(dialog).queryByRole("button", { name: "Yanıtı sil" })).not.toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText("Yanıtınız"), "  Teşekkürler!  ")
    await userEvent.click(send)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/product-reviews/prev_1/reply", {
        method: "POST",
        body: { body: "Teşekkürler!" },
      })
    })
    expect(toastMock.success).toHaveBeenCalledWith("Yanıt vitrinde yayında.")
    expect(onClose).toHaveBeenCalled()
  })

  it('updates a reply with "Yanıtı güncelle", lit only once the text changed', async () => {
    const { dialog } = open(review(REPLIED))
    const field = within(dialog).getByLabelText("Yanıtınız")
    const update = within(dialog).getByRole("button", { name: "Yanıtı güncelle" })

    expect(field).toHaveValue("Teşekkür ederiz.")
    expect(within(dialog).getByText("Yanıtlandı")).toBeInTheDocument()
    expect(within(dialog).getByText(/^Son yanıt/)).toBeInTheDocument()
    expect(update).toBeDisabled()
    await userEvent.type(field, " Yine bekleriz.")
    await userEvent.click(update)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/product-reviews/prev_1/reply", {
        method: "POST",
        body: { body: "Teşekkür ederiz. Yine bekleriz." },
      })
    })
    expect(toastMock.success).toHaveBeenCalledWith("Yanıt güncellendi.")
  })

  it("deletes a reply after asking", async () => {
    const { dialog } = open(review(REPLIED))

    await userEvent.click(within(dialog).getByRole("button", { name: "Yanıtı sil" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(within(confirm).getByText("Yanıt silinsin mi?")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    await userEvent.click(within(confirm).getByRole("button", { name: "Sil" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/product-reviews/prev_1/reply", {
        method: "DELETE",
      })
    })
    expect(toastMock.success).toHaveBeenCalledWith("Yanıt silindi.")
  })

  it("counts characters and holds a reply over 1,000 of them", async () => {
    const { dialog } = open(review())
    const field = within(dialog).getByLabelText("Yanıtınız")

    await userEvent.click(field)
    await userEvent.paste("ş".repeat(1001))

    expect(within(dialog).getByText("1001 / 1000 karakter")).toBeInTheDocument()
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/en çok 1000 karakter/)
    expect(within(dialog).getByRole("button", { name: "Yanıtla" })).toBeDisabled()
  })

  it("shows the API's refusal and stays open", async () => {
    fetchMock.mockRejectedValueOnce({
      status: 400,
      message: "Yalnızca onaylanmış yorumlara yanıt yazılabilir.",
    })
    const { dialog, onClose } = open(review())

    await userEvent.type(within(dialog).getByLabelText("Yanıtınız"), "Teşekkürler")
    await userEvent.click(within(dialog).getByRole("button", { name: "Yanıtla" }))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "Yalnızca onaylanmış yorumlara yanıt yazılabilir."
      )
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})
