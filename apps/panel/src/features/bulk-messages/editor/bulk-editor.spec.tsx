import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { renderEditor, savesOf } from "./bulk-editor.fixtures"
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

describe("BulkEditor (adr/0050 §10)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    saveMock.mockReset()
    toast.error.mockReset()
    vi.stubGlobal("fetch", saveMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("counts the audience on screen, and again once the sources change", async () => {
    const user = userEvent.setup()
    renderEditor(mocks)

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
    renderEditor(mocks)

    expect(await screen.findByLabelText(/Sadık müşteriler/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Toptancılar/)).toBeInTheDocument()
    expect(screen.getAllByText("Sadık müşteriler")).toHaveLength(1)
  })

  it("saves nothing without a name and says why", async () => {
    const user = userEvent.setup()
    renderEditor(mocks)

    await user.clear(screen.getByLabelText(/İletinin adı/))
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByText("İletiye bir ad verin.")).toBeInTheDocument()
    expect(savesOf(saveMock)).toHaveLength(0)
  })

  it("saves the whole draft in the backend's shape", async () => {
    const user = userEvent.setup()
    renderEditor(mocks)

    await user.click(await screen.findByLabelText(/Toptancılar/))
    await user.click(screen.getByRole("tab", { name: "İçerik" }))
    const preheader = screen.getByLabelText(/Önizleme satırı/)
    await user.clear(preheader)
    await user.type(preheader, "Yalnız bu hafta")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(savesOf(saveMock)).toHaveLength(1)
    })
    expect(savesOf(saveMock)[0]).toEqual({
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
    renderEditor(mocks)

    await user.click(screen.getByRole("tab", { name: "İçerik" }))
    const subject = screen.getByLabelText(/^Konu/)
    await user.clear(subject)
    await user.type(subject, "{{isim}, fırsat")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByText(/Tanınmayan bir belirteç var/)).toBeInTheDocument()
    expect(savesOf(saveMock)).toHaveLength(0)
  })

  it("holds the test and the send while changes are unsaved", async () => {
    const user = userEvent.setup()
    renderEditor(mocks)

    await user.type(screen.getByLabelText(/İletinin adı/), " 2")
    await user.click(screen.getByRole("tab", { name: "Deneme ve gönderim" }))

    expect(screen.getByRole("button", { name: "Bana gönder" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Şimdi gönder" })).toBeDisabled()
    expect(screen.getAllByText(/Kaydedilmemiş değişiklikler var/)).toHaveLength(2)
  })
})
