import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { i18next } from "@/lib/i18n"
import type { AiServiceView } from "@/features/ai/api/ai"
import { AiServicesTable } from "./ai-services-table"

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
  capabilities: ["text", "vision"],
  status,
  funding: "own_key",
  data_note_key: "ai.data_note.deepseek",
})

function renderRow(status: AiServiceView["status"], ownKeys = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AiServicesTable services={[service(status)]} ownKeys={ownKeys} keyConfigured />
    </QueryClientProvider>
  )
}

const button = (name: string) => screen.queryByRole("button", { name })
const MENU = "DeepSeek işlemleri"

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: MENU }))
  return screen.findByRole("menu")
}

describe("AiServiceRow", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    staff.accounts = true
    fetchMock.mockResolvedValue({ account: { provider: "deepseek" }, check: "valid" })
  })

  it("not connected: a row with the name, what it does, its state and only Bağla", () => {
    renderRow("not_connected")
    const row = screen.getByRole("row", { name: /DeepSeek/ })
    expect(within(row).getByText("DeepSeek")).toBeInTheDocument()
    expect(within(row).getByText("Bağlı değil")).toBeInTheDocument()
    expect(within(row).getByRole("list", { name: "Yapabildikleri" })).toHaveTextContent(
      /Metin yazma.*Görseli anlama/
    )
    expect(within(row).getByRole("button", { name: "Bağla" })).toBeEnabled()
    expect(button(MENU)).toBeNull()
  })

  it("where the data goes is behind the (i), named and described for a screen reader", async () => {
    renderRow("not_connected")
    const tip = screen.getByRole("button", { name: "Bilgi: DeepSeek verisi nereye gider" })
    expect(tip).toHaveAccessibleDescription(/Veri Çin'de işlenir.*Kişisel veri gönderilmez/)
    // Not on the page until asked: the row stays one line
    expect(screen.queryByRole("tooltip")).toBeNull()
    tip.focus()
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/Kişisel veri gönderilmez/)
  })

  it("Qwen: its name, what it does and where its data goes (Singapore, no mainland nodes)", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <AiServicesTable
          services={[
            { ...service("not_connected"), id: "qwen", data_note_key: "ai.data_note.qwen" },
          ]}
          ownKeys
          keyConfigured
        />
      </QueryClientProvider>
    )
    const row = screen.getByRole("row", { name: /Qwen \(Alibaba\)/ })
    expect(within(row).getByText(/metin ve görsel okuma servisi/)).toBeInTheDocument()
    const tip = screen.getByRole("button", { name: "Bilgi: Qwen (Alibaba) verisi nereye gider" })
    expect(tip).toHaveAccessibleDescription(/Singapur'da saklanır.*Çin anakarası dışındaki/)
  })

  it("connected: change the key, test it, remove it from the menu", async () => {
    renderRow("connected")
    expect(screen.getByText("Bağlı")).toBeInTheDocument()
    expect(button("Bağla")).toBeNull()
    const menu = await openMenu()
    expect(within(menu).getByRole("menuitem", { name: "Anahtarı değiştir" })).toBeInTheDocument()
    expect(within(menu).getByRole("menuitem", { name: "Kaldır" })).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Bağlantıyı test et" }))
    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/integrations/credentials/deepseek/check",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("names the test and the save as every provider account does", () => {
    for (const lng of ["tr", "en"]) {
      const t = i18next.getFixedT(lng)
      const test = t("ai.card.test")
      expect(test).toBe(t("settings.payments.account.test"))
      expect(test).toBe(t("settings.integrations.test"))
      expect(t("ai.card.save")).toBe(t("settings.payments.account.save"))
      // The shared toast sends the reader back to this very button
      expect(t("settings.payments.account.checks.unreachable", { name: "X" })).toContain(test)
    }
  })

  it("rejected and unreadable say what to do in a line under the row", async () => {
    const { unmount } = renderRow("rejected")
    expect(screen.getByText("DeepSeek reddetti")).toBeInTheDocument()
    expect(screen.getByText(/DeepSeek kayıtlı anahtarı reddetti/)).toBeInTheDocument()
    unmount()
    renderRow("unreadable")
    expect(screen.getByText("Yeniden girilmeli")).toBeInTheDocument()
    expect(screen.getByText(/Gizli bilgileri yeniden girin/)).toBeInTheDocument()
    expect(button("Bağla")).toBeInTheDocument()
    // Nothing to test, but what is left can be removed
    const menu = await openMenu()
    expect(within(menu).queryByRole("menuitem", { name: "Bağlantıyı test et" })).toBeNull()
    expect(within(menu).getByRole("menuitem", { name: "Kaldır" })).toBeInTheDocument()
  })

  it("the key field is never filled back, and the dialog shows where the data goes", async () => {
    renderRow("connected")
    const menu = await openMenu()
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Anahtarı değiştir" }))
    const dialog = await screen.findByRole("dialog")
    const field = within(dialog).getByLabelText<HTMLInputElement>(/Anahtar/)
    expect(field.type).toBe("password")
    expect(field.value).toBe("")
    expect(within(dialog).getByText(/Veri Çin'de işlenir/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Kişisel veri gönderilmez/)).toBeInTheDocument()
    // Nothing typed: nothing is sent
    expect(within(dialog).getByRole("button", { name: "Kaydet ve doğrula" })).toBeDisabled()
    // Only spaces: refused here, nothing is sent
    await userEvent.type(field, "   ")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet ve doğrula" }))
    expect(await within(dialog).findByText("Anahtarı girin.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    await userEvent.clear(field)
    await userEvent.type(field, "test-key-not-a-real-one-0000")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet ve doğrula" }))
    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/integrations/credentials/deepseek",
      expect.objectContaining({
        method: "POST",
        body: { settings: {}, secrets: { api_key: "test-key-not-a-real-one-0000" } },
      })
    )
  })

  it("one who is not the owner sees the state, not the buttons that connect", async () => {
    staff.accounts = false
    renderRow("connected")
    expect(screen.getByText("Bağlı")).toBeInTheDocument()
    expect(button("Bağla")).toBeNull()
    expect(screen.getByText("Servisi mağaza sahibi bağlayabilir.")).toBeInTheDocument()
    const menu = await openMenu()
    expect(within(menu).queryByRole("menuitem", { name: "Anahtarı değiştir" })).toBeNull()
    expect(within(menu).queryByRole("menuitem", { name: "Kaldır" })).toBeNull()
    // The admin may still test what is stored (adr/0071 §6)
    expect(within(menu).getByRole("menuitem", { name: "Bağlantıyı test et" })).toBeInTheDocument()
  })

  it("with the package leaving the own key out, nothing connects or tests", async () => {
    renderRow("connected", false)
    expect(screen.getByText(/paketiniz izin vermediği için kullanılmıyor/)).toBeInTheDocument()
    const menu = await openMenu()
    expect(within(menu).getByRole("menuitem", { name: "Anahtarı değiştir" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
    expect(within(menu).getByRole("menuitem", { name: "Bağlantıyı test et" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
  })
})
