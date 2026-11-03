import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BulkMessage } from "@/features/bulk-messages/api/types"
import { campaign, clientWith, preview } from "@/features/bulk-messages/bulk-messages.fixtures"
import { BulkEditor } from "./bulk-editor"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
}))
// The page editor runs on ProseMirror, which jsdom cannot lay out: a text area stands in
vi.mock("@/features/content/editor/rich-editor", () => ({
  RichEditor: ({
    value,
    onChange,
    label,
  }: {
    value: JSONContent
    onChange: (doc: JSONContent) => void
    label: string
  }) => (
    <textarea
      aria-label={label}
      value={value.content?.[0]?.content?.[0]?.text ?? ""}
      onChange={(event) => {
        onChange({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: event.target.value }] }],
        })
      }}
    />
  ),
}))

const MARKETING = {
  abandoned_cart_enabled: false,
  abandoned_cart_delay_minutes: 60,
  feed_exclusions: { google: [], meta: [], cimri: [], akakce: [] },
  feed_same_day_cutoff_hour: null,
  campaign_frequency_cap: true,
  campaign_sms_start_hour: 9,
  campaign_sms_end_hour: 20,
  sms_opt_out_text: "Ret için RET yazıp 4609'a gönderin",
}

function serve(stored: BulkMessage) {
  fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    switch (url) {
      case "/admin/customer-segments":
        return Promise.resolve({
          segments: [
            {
              id: "cseg_1",
              name: "Sadık müşteriler",
              rules: {},
              customer_group_id: "cusgroup_seg",
              member_count: 120,
              refreshed_at: null,
            },
          ],
        })
      case "/admin/customer-groups":
        return Promise.resolve({
          customer_groups: [
            { id: "cusgroup_1", name: "Toptancılar", metadata: null, customers: [{ id: "c1" }] },
            {
              id: "cusgroup_seg",
              name: "Sadık müşteriler",
              metadata: { managed_by: "segment" },
              customers: [],
            },
          ],
        })
      case "/admin/shop-tokens":
        return Promise.resolve({
          tokens: [
            { name: "mağaza_adı", value: "Bıçakçı" },
            { name: "telefon", value: "0532 000 00 00" },
          ],
        })
      case "/admin/platform-settings/marketing":
        return Promise.resolve({ section: "marketing", values: MARKETING, version: 1 })
      case "/admin/bulk-messages/bm_1/audience-preview":
        return Promise.resolve(preview())
      case "/admin/bulk-messages/bm_1":
        return Promise.resolve({
          campaign: { ...stored, ...(init?.body as Partial<BulkMessage>) },
        })
      default:
        return Promise.reject(new Error(`unexpected ${url}`))
    }
  })
}

function renderEditor(stored: BulkMessage = campaign()) {
  serve(stored)
  return render(
    <QueryClientProvider client={clientWith()}>
      <BulkEditor campaign={stored} />
    </QueryClientProvider>
  )
}

const saves = () =>
  fetchMock.mock.calls.filter(
    ([url, init]) => url === "/admin/bulk-messages/bm_1" && (init as { method?: string }).method
  )

describe("BulkEditor (adr/0050 §10)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("counts the audience on screen, and again once the sources change", async () => {
    const user = userEvent.setup()
    renderEditor()

    expect(await screen.findByText("1.240 kişi")).toBeInTheDocument()
    expect(screen.getByText("İzni İYS'ye henüz bildirilmedi")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/bulk-messages/bm_1/audience-preview", {
      method: "POST",
      body: { channel: "email", audience: [{ kind: "all_consented" }] },
    })

    await user.click(await screen.findByLabelText(/Bülten aboneleri/))
    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledWith("/admin/bulk-messages/bm_1/audience-preview", {
          method: "POST",
          body: {
            channel: "email",
            audience: [{ kind: "all_consented" }, { kind: "newsletter" }],
          },
        })
      },
      { timeout: 3000 }
    )
  })

  it("offers the shop's segments and its own groups, a segment's group once", async () => {
    renderEditor()

    expect(await screen.findByLabelText(/Sadık müşteriler/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Toptancılar/)).toBeInTheDocument()
    expect(screen.getAllByText("Sadık müşteriler")).toHaveLength(1)
  })

  it("saves nothing without a name and says why", async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.clear(screen.getByLabelText(/İletinin adı/))
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByText("İletiye bir ad verin.")).toBeInTheDocument()
    expect(saves()).toHaveLength(0)
  })

  it("saves the whole draft in the backend's shape", async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(await screen.findByLabelText(/Toptancılar/))
    await user.click(screen.getByRole("tab", { name: "İçerik" }))
    const preheader = screen.getByLabelText(/Önizleme satırı/)
    await user.clear(preheader)
    await user.type(preheader, "Yalnız bu hafta")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(saves()).toHaveLength(1)
    })
    expect(saves()[0]?.[1]).toEqual({
      method: "POST",
      body: {
        name: "Kış indirimi",
        channel: "email",
        audience: [{ kind: "all_consented" }, { kind: "group", id: "cusgroup_1" }],
        subject: "{ad}, kış indirimi başladı",
        preheader: "Yalnız bu hafta",
        body: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Merhaba {ad}" }] }],
        },
        sms_text: null,
      },
    })
  })

  it("refuses an unknown token before the server does", async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole("tab", { name: "İçerik" }))
    const subject = screen.getByLabelText(/^Konu/)
    await user.clear(subject)
    await user.type(subject, "{{isim}, fırsat")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByText(/Tanınmayan bir belirteç var/)).toBeInTheDocument()
    expect(saves()).toHaveLength(0)
  })

  it("holds the test and the send while changes are unsaved", async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.type(screen.getByLabelText(/İletinin adı/), " 2")
    await user.click(screen.getByRole("tab", { name: "Deneme ve gönderim" }))

    expect(screen.getByRole("button", { name: "Bana gönder" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Şimdi gönder" })).toBeDisabled()
    expect(screen.getAllByText(/Kaydedilmemiş değişiklikler var/)).toHaveLength(2)
  })

  it("counts a text with its fixed end and shows it as it goes", async () => {
    const user = userEvent.setup()
    renderEditor(campaign({ channel: "sms", sms_text: "{ad}, kış indirimi başladı" }))

    await user.click(screen.getByRole("tab", { name: "İçerik" }))

    expect(await screen.findByText(/karakter · 1\/3 SMS/)).toBeInTheDocument()
    expect(screen.getByText("Bıçakçı. Ret için RET yazıp 4609'a gönderin")).toBeInTheDocument()
    const bubble = screen.getByLabelText("SMS önizlemesi")
    expect(
      within(bubble).getByText(/^Değerli müşterimiz, kış indirimi başladı\. Bıçakçı\./)
    ).toBeInTheDocument()
  })
})
