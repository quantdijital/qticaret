import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { campaign, preview } from "@/features/bulk-messages/bulk-messages.fixtures"
import { SMS_SHOWN, json, renderEditor } from "./bulk-editor.fixtures"
const fetchMock = vi.hoisted(() => vi.fn())
// A save goes past the SDK, to keep the refusal's key
const saveMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))
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

const mocks = { fetch: fetchMock, save: saveMock }

describe("BulkEditor: the backend's counts and refusals (adr/0050 §4, §6)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    saveMock.mockReset()
    toast.error.mockReset()
    vi.stubGlobal("fetch", saveMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("counts the stored text as the backend does, the typing count only a guide", async () => {
    const user = userEvent.setup()
    renderEditor(mocks, {
      stored: campaign({ channel: "sms", sms_text: "{ad}, kış indirimi başladı" }),
    })

    await user.click(screen.getByRole("tab", { name: "İçerik" }))

    // Stored: the backend's count at the longest name wins over the panel's one part
    expect(
      await screen.findByText(
        "Kayıtlı metin en çok 2/3 parça; en uzun alıcı adı ve bağlantıların kampanya koduyla sayıldı."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Bıçakçı. Ret için RET yazıp 4609'a gönderin")).toBeInTheDocument()
    expect(within(screen.getByLabelText("SMS önizlemesi")).getByText(SMS_SHOWN)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/SMS metni/), " Kaçırmayın.")
    expect(await screen.findByText(/^Yaklaşık .* karakter · 1\/3 SMS/)).toBeInTheDocument()
    expect(screen.getByText(/kesin sayı kaydedince hesaplanır/)).toBeInTheDocument()
  })

  it("puts a text the backend counts past three parts under its field", async () => {
    const user = userEvent.setup()
    renderEditor(mocks, { stored: campaign({ channel: "sms", sms_text: "Kış indirimi başladı" }) })
    saveMock.mockImplementation(() =>
      json(400, {
        type: "invalid_data",
        code: "campaigns.sms_too_long",
        message:
          "SMS metni, mağaza adı ve ret metniyle birlikte en çok 3 SMS boyunu geçmemeli; metni kısaltın.",
      })
    )

    await user.click(screen.getByRole("tab", { name: "İçerik" }))
    await user.type(screen.getByLabelText(/SMS metni/), " https://magaza.example/indirim")
    await user.click(screen.getByRole("tab", { name: "Kitle" }))
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(
      await screen.findByText(
        "Metin, en uzun alıcı adı ve bağlantıların kampanya koduyla 3 parçayı geçiyor; kısaltın."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "İçerik" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByLabelText(/SMS metni/)).toHaveAttribute("aria-invalid", "true")
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("says another refusal of a save in the backend's words", async () => {
    const user = userEvent.setup()
    renderEditor(mocks)
    saveMock.mockImplementation(() =>
      json(409, {
        type: "conflict",
        code: "campaigns.locked",
        message:
          "Bu ileti zamanlandı ya da gönderilmeye başladı; içeriği değişmez. Değiştirmek için kopyalayın.",
      })
    )

    await user.type(screen.getByLabelText(/İletinin adı/), " 2")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Bu ileti zamanlandı ya da gönderilmeye başladı; içeriği değişmez. Değiştirmek için kopyalayın."
      )
    })
  })

  it("holds the send for an audience that reaches no one, in the backend's words", async () => {
    const user = userEvent.setup()
    renderEditor(mocks, { audience: preview({ eligible: 0 }) })

    await user.click(screen.getByRole("tab", { name: "Deneme ve gönderim" }))

    expect(
      await screen.findByText(
        "Bu kitlede iletiyi alabilecek kimse yok (izin, bastırma listesi ya da 24 saat sınırı). Kitleyi değiştirin."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Şimdi gönder" })).toBeDisabled()
  })
})
