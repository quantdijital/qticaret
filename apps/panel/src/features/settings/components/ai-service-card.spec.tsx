import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AiServiceView } from "@/features/ai/api/ai"
import { AiServiceCard } from "./ai-service-card"

const fetchMock = vi.hoisted(() => vi.fn())
const staff = vi.hoisted(() => ({ accounts: true }))
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: toasts }))
// The owner passes reauth at once
vi.mock("@/lib/reauth", () => ({
  withReauth: (call: (extra: object) => Promise<unknown>) => call({}),
  isReauthCancelled: () => false,
}))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: (capability: string) => capability === "accounts" && staff.accounts,
}))

const service = (status: AiServiceView["status"]): AiServiceView => ({
  id: "deepseek",
  capabilities: ["text"],
  status,
  funding: "own_key",
  data_note_key: "ai.data_note.deepseek",
})

function renderCard(status: AiServiceView["status"], ownKeys = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AiServiceCard service={service(status)} ownKeys={ownKeys} keyConfigured />
    </QueryClientProvider>
  )
}

const button = (name: string) => screen.queryByRole("button", { name })

describe("AiServiceCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    staff.accounts = true
    fetchMock.mockResolvedValue({ account: { provider: "deepseek" }, check: "valid" })
  })

  it("not connected: the name, what it does, where the data goes and only Bağla", () => {
    renderCard("not_connected")
    expect(screen.getByRole("heading", { name: "DeepSeek" })).toBeInTheDocument()
    expect(screen.getByText("Bağlı değil")).toBeInTheDocument()
    expect(screen.getByText("Metin yazma")).toBeInTheDocument()
    expect(screen.getByText(/Veri Çin'de işlenir/)).toBeInTheDocument()
    expect(screen.getByText(/Kişisel veri gönderilmez/)).toBeInTheDocument()
    expect(button("Bağla")).toBeInTheDocument()
    expect(button("Bağlantıyı dene")).toBeNull()
    expect(button("Kaldır")).toBeNull()
  })

  it("connected: change the key, test it, remove it", async () => {
    renderCard("connected")
    expect(screen.getByText("Bağlı")).toBeInTheDocument()
    expect(button("Anahtarı değiştir")).toBeInTheDocument()
    expect(button("Kaldır")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Bağlantıyı dene" }))
    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/integrations/credentials/deepseek/check",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("rejected and unreadable say what to do", () => {
    const { unmount } = renderCard("rejected")
    expect(screen.getByText("DeepSeek reddetti")).toBeInTheDocument()
    expect(screen.getByText(/DeepSeek kayıtlı anahtarı reddetti/)).toBeInTheDocument()
    unmount()
    renderCard("unreadable")
    expect(screen.getByText("Yeniden girilmeli")).toBeInTheDocument()
    expect(button("Bağla")).toBeInTheDocument()
  })

  it("the key field is never filled back, and the dialog shows where the data goes", async () => {
    renderCard("connected")
    await userEvent.click(screen.getByRole("button", { name: "Anahtarı değiştir" }))
    const dialog = await screen.findByRole("dialog")
    const field = within(dialog).getByLabelText<HTMLInputElement>(/Anahtar/)
    expect(field.type).toBe("password")
    expect(field.value).toBe("")
    expect(within(dialog).getByText(/Veri Çin'de işlenir/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Kişisel veri gönderilmez/)).toBeInTheDocument()
    // Nothing typed: nothing is sent
    expect(within(dialog).getByRole("button", { name: "Kaydet ve dene" })).toBeDisabled()
    // Only spaces: refused here, nothing is sent
    await userEvent.type(field, "   ")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet ve dene" }))
    expect(await within(dialog).findByText("Anahtarı girin.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    await userEvent.clear(field)
    await userEvent.type(field, "test-key-not-a-real-one-0000")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet ve dene" }))
    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/integrations/credentials/deepseek",
      expect.objectContaining({
        method: "POST",
        body: { settings: {}, secrets: { api_key: "test-key-not-a-real-one-0000" } },
      })
    )
  })

  it("one who is not the owner sees the state, not the buttons that connect", () => {
    staff.accounts = false
    renderCard("connected")
    expect(screen.getByText("Bağlı")).toBeInTheDocument()
    expect(button("Anahtarı değiştir")).toBeNull()
    expect(button("Bağla")).toBeNull()
    expect(button("Kaldır")).toBeNull()
    expect(screen.getByText("Servisi mağaza sahibi bağlayabilir.")).toBeInTheDocument()
    // The admin may still test what is stored (adr/0071 §6)
    expect(button("Bağlantıyı dene")).toBeInTheDocument()
  })

  it("with the package leaving the own key out, nothing connects or tests", () => {
    renderCard("connected", false)
    expect(button("Anahtarı değiştir")).toBeDisabled()
    expect(button("Bağlantıyı dene")).toBeDisabled()
    expect(screen.getByText(/paketiniz izin vermediği için kullanılmıyor/)).toBeInTheDocument()
  })
})
