import { QueryClientProvider } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LinkShare, PaymentLink } from "@/features/payment-links/api/types"
import {
  around,
  clientWith,
  link,
  refused,
  share,
} from "@/features/payment-links/payment-links.fixtures"
import { PaymentLinkPage } from "./payment-link-page"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const search = vi.hoisted((): { current: Record<string, unknown> } => ({ current: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search: query,
    className,
  }: {
    children: ReactNode
    to: string
    search?: Record<string, string>
    className?: string
  }) => (
    <a href={query ? `${to}?${new URLSearchParams(query).toString()}` : to} className={className}>
      {children}
    </a>
  ),
  getRouteApi: () => ({
    useParams: () => ({ id: "plink_01" }),
    useSearch: () => search.current,
  }),
}))

type Init = { method?: string; body?: unknown } | undefined

function serve(
  answer: PaymentLink = link(),
  shared: LinkShare = share(),
  actions: Record<string, (init: Init) => Promise<unknown>> = {}
) {
  fetchMock.mockImplementation((url: string, init: Init) => {
    const action = Object.entries(actions).find(([path]) => url === path)
    if (action) {
      return action[1](init)
    }
    if (url === "/admin/payment-links/plink_01") {
      return Promise.resolve({ payment_link: answer })
    }
    if (url === "/admin/payment-links/plink_01/share") {
      return Promise.resolve({ share: shared })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

function renderPage(client: QueryClient = clientWith()) {
  return render(
    <QueryClientProvider client={client}>
      <PaymentLinkPage />
    </QueryClientProvider>
  )
}

const card = (title: string) => within(around(screen.getByText(title), "section"))

describe("PaymentLinkPage (adr/0051 §7, §13)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toast.success.mockReset()
    toast.error.mockReset()
    search.current = {}
  })

  it("shows the link just made with its customer, lines and the share card", async () => {
    search.current = { created: true }
    serve()
    renderPage()

    expect(await screen.findByRole("heading", { name: "PL-1042" })).toBeInTheDocument()
    expect(screen.getByText("Açık")).toBeInTheDocument()
    expect(await screen.findByText(/Bağlantı hazır\./)).toBeInTheDocument()
    const sharing = card("Paylaş")
    expect(sharing.getByLabelText("Ödeme bağlantısı")).toHaveValue(
      "https://magaza.example.com/ode/pl_token"
    )
    expect(sharing.getByLabelText("Mesaj metni")).toHaveValue(share().sms_text)
    expect(sharing.getByRole("link", { name: "WhatsApp'ta aç" })).toHaveAttribute(
      "href",
      share().whatsapp_url
    )
    expect(sharing.getByText("E-posta gönderilmedi")).toBeInTheDocument()
    expect(sharing.getByText("SMS gönderilmedi")).toBeInTheDocument()

    expect(screen.getByText("ayse.yilmaz@example.com")).toBeInTheDocument()
    expect(screen.getByText("Şef bıçağı")).toBeInTheDocument()
    expect(screen.getByText("Toplam").parentElement).toHaveTextContent("Toplam₺270,00")
    expect(screen.getByText(/Ece Demir/)).toBeInTheDocument()
    expect(screen.getByText("Instagram'dan yazdı")).toBeInTheDocument()
  })

  it("sends the link by e-mail and says what each channel came to", async () => {
    const user = userEvent.setup()
    serve(link(), share(), {
      "/admin/payment-links/plink_01/resend": () =>
        Promise.resolve({ outcomes: { email: "sent" } }),
    })
    renderPage()

    await user.click(await screen.findByRole("button", { name: "E-postayla gönder" }))

    expect(await screen.findByText("E-posta: gönderildi.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/payment-links/plink_01/resend", {
      method: "POST",
      body: { channels: ["email"] },
    })
    expect(toast.success).toHaveBeenCalledWith("Bağlantı gönderildi.")
  })

  it("says why an SMS did not go, and a send too soon in the backend's words", async () => {
    const user = userEvent.setup()
    let tries = 0
    serve(link(), share({ sms_sent: true }), {
      "/admin/payment-links/plink_01/resend": () =>
        ++tries === 1
          ? Promise.resolve({ outcomes: { sms: "channel_off" } })
          : Promise.reject(
              refused(409, "Bu bağlantı az önce gönderildi; 10 dakika sonra yeniden deneyin.")
            ),
    })
    renderPage()

    await user.click(await screen.findByRole("button", { name: "SMS'i yeniden gönder" }))
    expect(
      await screen.findByText("SMS: kanal kapalı ya da hesap bağlı değil.")
    ).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "SMS'i yeniden gönder" }))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Bu bağlantı az önce gönderildi; 10 dakika sonra yeniden deneyin."
      )
    })
  })

  it("extends an open link, the seventh day explained, and shows a refusal in the dialog", async () => {
    const user = userEvent.setup()
    let tries = 0
    serve(link(), share(), {
      "/admin/payment-links/plink_01/extend": () =>
        ++tries === 1
          ? Promise.reject(
              refused(
                400,
                "Bağlantı oluşturulduğundan en çok 7 gün geçerli olabilir; daha fazla uzatılamaz."
              )
            )
          : Promise.resolve({ payment_link: link({ expires_at: "2026-11-08T09:00:00Z" }) }),
    })
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Uzat" }))
    const dialog = within(await screen.findByRole("dialog"))
    expect(dialog.getByText(/en çok 7 gün/)).toBeInTheDocument()
    const hours = dialog.getByLabelText(/Şimdiden itibaren/)
    await user.clear(hours)
    await user.type(hours, "48")
    await user.click(dialog.getByRole("button", { name: "Uzat" }))
    expect(await dialog.findByText(/daha fazla uzatılamaz/)).toBeInTheDocument()

    await user.click(dialog.getByRole("button", { name: "Uzat" }))
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/tarihine kadar açık/))
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/payment-links/plink_01/extend", {
      method: "POST",
      body: { hours: 48 },
    })
  })

  it("cancels after asking once more", async () => {
    const user = userEvent.setup()
    serve(link(), share(), {
      "/admin/payment-links/plink_01/cancel": () =>
        Promise.resolve({ payment_link: link({ status: "canceled" }) }),
    })
    renderPage()

    await user.click(await screen.findByRole("button", { name: "İptal et" }))
    const ask = within(await screen.findByRole("alertdialog"))
    expect(ask.getByText("PL-1042 iptal edilsin mi?")).toBeInTheDocument()
    await user.click(ask.getByRole("button", { name: "İptal et" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/payment-links/plink_01/cancel", {
        method: "POST",
        body: {},
      })
    })
    expect(toast.success).toHaveBeenCalledWith("PL-1042 iptal edildi.")
  })

  it("leaves extending and cancelling to the owner and admins", async () => {
    serve()
    renderPage(clientWith({ role: "operations" }))

    expect(await screen.findByRole("button", { name: "E-postayla gönder" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Uzat" })).toBeNull()
    expect(screen.queryByRole("button", { name: "İptal et" })).toBeNull()
  })

  it("explains a link whose prices moved and opens a new one filled from it", async () => {
    serve(link({ status: "draft" }), share({ url: null, sms_text: null, whatsapp_url: null }))
    renderPage()

    expect(await screen.findByText("Fiyat değişti")).toBeInTheDocument()
    expect(screen.getByText(/müşteri bu bağlantıyla ödeme yapamaz/)).toBeInTheDocument()
    for (const again of screen.getAllByRole("link", { name: /Yeniden oluştur/ })) {
      expect(again).toHaveAttribute("href", "/payment-links/new?from=plink_01")
    }
    expect(
      await screen.findByText("Bağlantı artık açık değil; paylaşılacak bir şey yok.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "E-postayla gönder" })).toBeNull()
    // A repriced link can still be cancelled; it can no longer be extended
    expect(screen.getByRole("button", { name: "İptal et" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Uzat" })).toBeNull()
  })

  it("leads a paid link to its order", async () => {
    serve(
      link({ status: "paid", order_id: "order_1", paid_at: "2026-11-04T10:00:00Z" }),
      share({ url: null, sms_text: null, whatsapp_url: null, email_sent: true })
    )
    renderPage()

    expect(await screen.findByRole("link", { name: /ödendi; siparişi aç/ })).toHaveAttribute(
      "href",
      "/orders/$id"
    )
    expect(await screen.findByText("E-posta gönderildi")).toBeInTheDocument()
  })
})
