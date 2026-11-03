import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { Returnable } from "@/features/orders/api/returns"
import { OpenReturnDialog } from "./open-return-dialog"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))

const RETURNABLE: Returnable = {
  window_open: true,
  open_request: false,
  lines: [
    {
      line_item_id: "item_1",
      title: "Pamuklu Tişört",
      variant_title: "M",
      variant_id: "variant_m",
      returnable: 2,
      withdrawal_excluded: false,
      withdrawal_excluded_reason: null,
      gift_card: false,
      variants: [
        { id: "variant_l", title: "L" },
        { id: "variant_s", title: "S" },
      ],
    },
    {
      line_item_id: "item_2",
      title: "Seramik Kupa",
      variant_title: null,
      variant_id: "variant_k",
      returnable: 0,
      withdrawal_excluded: false,
      withdrawal_excluded_reason: null,
      gift_card: false,
      variants: [],
    },
    {
      line_item_id: "item_3",
      title: "İsme Özel Kolye",
      variant_title: null,
      variant_id: "variant_n",
      returnable: 1,
      withdrawal_excluded: true,
      withdrawal_excluded_reason: "product",
      gift_card: false,
      variants: [{ id: "variant_o", title: "Altın" }],
    },
  ],
}

function renderDialog(onClose = vi.fn(), returnable = RETURNABLE) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <OpenReturnDialog orderId="order_1" returnable={returnable} onClose={onClose} />
    </QueryClientProvider>
  )
  return onClose
}

// A knife and a gift card line of two untouched cards (adr/0025 Ek 2026-11-03)
const WITH_GIFT: Returnable = {
  window_open: true,
  open_request: false,
  lines: [
    {
      line_item_id: "item_1",
      title: "Şef bıçağı",
      variant_title: null,
      variant_id: "variant_k",
      returnable: 1,
      withdrawal_excluded: false,
      withdrawal_excluded_reason: null,
      gift_card: false,
      variants: [{ id: "variant_l", title: "Uzun" }],
    },
    {
      line_item_id: "item_2",
      title: "Hediye kartı",
      variant_title: "500 TL",
      variant_id: "variant_500",
      returnable: 2,
      withdrawal_excluded: false,
      withdrawal_excluded_reason: null,
      gift_card: true,
      variants: [{ id: "variant_250", title: "250 TL" }],
    },
  ],
}

const chooseReason = async (user: ReturnType<typeof userEvent.setup>, reason: string) => {
  await user.click(screen.getByRole("combobox", { name: "Neden" }))
  await user.click(screen.getByRole("option", { name: reason }))
}

describe("OpenReturnDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ return_request: { id: "ret_1" } })
    vi.clearAllMocks()
  })

  it("lists only lines with units left, and opens an exchange with each line's new variant", async () => {
    const user = userEvent.setup()
    const onClose = renderDialog()
    const dialog = screen.getByRole("dialog")

    expect(within(dialog).queryByText("Seramik Kupa")).toBeNull()
    await user.click(within(dialog).getByRole("radio", { name: "Değişim" }))
    const quantity = within(dialog).getByLabelText("Pamuklu Tişört")
    await user.clear(quantity)
    await user.type(quantity, "5")
    // No more than is left
    expect(quantity).toHaveValue(2)
    await chooseReason(user, "Beden/ölçü uymadı")
    expect(within(dialog).getByRole("button", { name: "Talebi aç" })).toBeDisabled()
    await user.click(within(dialog).getByRole("combobox", { name: "Yerine gidecek seçenek" }))
    await user.click(screen.getByRole("option", { name: "L" }))
    await user.click(within(dialog).getByRole("button", { name: "Talebi aç" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/return-requests", {
      method: "POST",
      body: {
        kind: "exchange",
        reason: "size_issue",
        items: [{ line_item_id: "item_1", quantity: 2, variant_id: "variant_l" }],
      },
    })
    expect(toast.success).toHaveBeenCalledWith("Talep açıldı; müşteriye e-posta gönderildi.")
    expect(onClose).toHaveBeenCalled()
  })

  it("opens a return with a note", async () => {
    const user = userEvent.setup()
    renderDialog()
    const dialog = screen.getByRole("dialog")

    await user.type(within(dialog).getByLabelText("Pamuklu Tişört"), "1")
    await chooseReason(user, "Hasarlı geldi")
    await user.type(within(dialog).getByLabelText("Not (isteğe bağlı)"), "Telefonla bildirdi")
    await user.click(within(dialog).getByRole("button", { name: "Talebi aç" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/return-requests", {
      method: "POST",
      body: {
        kind: "return",
        reason: "damaged",
        items: [{ line_item_id: "item_1", quantity: 1 }],
        note: "Telefonla bildirdi",
      },
    })
  })

  it("takes a product outside the right of withdrawal back only as faulty, never exchanged", async () => {
    const user = userEvent.setup()
    renderDialog()
    const dialog = screen.getByRole("dialog")
    const submit = within(dialog).getByRole("button", { name: "Talebi aç" })

    // The server's flag, as the badge beside the line
    expect(within(dialog).getAllByText("Cayma dışı")).toHaveLength(1)
    await user.type(within(dialog).getByLabelText("İsme Özel Kolye"), "1")
    await chooseReason(user, "Fikrim değişti")
    expect(within(dialog).getByRole("status")).toHaveTextContent("yalnızca hasarlı")
    expect(submit).toBeDisabled()

    await user.click(within(dialog).getByRole("radio", { name: "Değişim" }))
    expect(within(dialog).getByRole("status")).toHaveTextContent("değişim yapılamaz")

    await user.click(within(dialog).getByRole("radio", { name: "İade" }))
    await chooseReason(user, "Hasarlı geldi")
    expect(within(dialog).queryByRole("status")).toBeNull()
    await user.click(submit)

    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/return-requests", {
      method: "POST",
      body: {
        kind: "return",
        reason: "damaged",
        items: [{ line_item_id: "item_3", quantity: 1 }],
      },
    })
  })

  it("asks a gift card line back on its own, as money back, saying no parcel is waited for", async () => {
    const user = userEvent.setup()
    renderDialog(vi.fn(), WITH_GIFT)
    const dialog = screen.getByRole("dialog")
    const submit = within(dialog).getByRole("button", { name: "Talebi aç" })
    const giftRow = within(dialog).getByLabelText("Hediye kartı").closest("li")
    if (!giftRow) {
      throw new Error("the gift card line is not listed")
    }
    expect(giftRow).toHaveTextContent("2 kart iade edilebilir")

    // With a physical line: refused before the server does
    await user.type(within(dialog).getByLabelText("Şef bıçağı"), "1")
    await user.type(within(dialog).getByLabelText("Hediye kartı"), "1")
    await chooseReason(user, "Fikrim değişti")
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Hediye kartı kalemleri ayrı bir talepte ve yalnızca para iadesi olarak istenebilir."
    )
    expect(submit).toBeDisabled()

    // As an exchange: refused the same way, and no variant asked for the card
    await user.clear(within(dialog).getByLabelText("Şef bıçağı"))
    await user.click(within(dialog).getByRole("radio", { name: "Değişim" }))
    expect(within(dialog).getByRole("status")).toHaveTextContent("ayrı bir talepte")
    expect(within(dialog).queryByRole("combobox", { name: "Yerine gidecek seçenek" })).toBeNull()

    await user.click(within(dialog).getByRole("radio", { name: "İade" }))
    expect(within(dialog).queryByRole("status")).toBeNull()
    expect(
      within(dialog).getByText(
        "Hediye kartı iadesi: kartlar iptal edilir, para iadesi hemen yapılır; kargo beklenmez."
      )
    ).toBeInTheDocument()
    await user.click(submit)

    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/return-requests", {
      method: "POST",
      body: {
        kind: "return",
        reason: "changed_mind",
        items: [{ line_item_id: "item_2", quantity: 1 }],
      },
    })
  })

  it("names why a gift card line is outside the right of withdrawal once a card was spent", async () => {
    const user = userEvent.setup()
    const spent: Returnable = {
      ...WITH_GIFT,
      lines: WITH_GIFT.lines.map((line) =>
        line.gift_card
          ? { ...line, withdrawal_excluded: true, withdrawal_excluded_reason: "gift_card_used" }
          : line
      ),
    }
    renderDialog(vi.fn(), spent)
    const dialog = screen.getByRole("dialog")

    expect(within(dialog).getByText("Cayma dışı · kart kullanıldı")).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText("Hediye kartı"), "1")
    await chooseReason(user, "Hasarlı geldi")
    expect(within(dialog).getByRole("status")).toHaveTextContent("harcama yapıldığı için")
    expect(within(dialog).getByRole("button", { name: "Talebi aç" })).toBeDisabled()
  })
})
