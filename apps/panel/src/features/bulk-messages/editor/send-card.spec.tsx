import { QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { campaign, clientWith, preview } from "@/features/bulk-messages/bulk-messages.fixtures"
import { toLocalInput } from "@/features/storefront/layout/schedule"
import { setReauthAsker } from "@/lib/reauth"
import type { ReauthAsk } from "@/lib/reauth"
import { SendCard } from "./send-card"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))

const refused = (status: number, message = "refused") =>
  Object.assign(new Error(message), { status, message })

const DAY = 24 * 60 * 60 * 1000
const inDays = (days: number) => toLocalInput(new Date(Date.now() + days * DAY).toISOString())

function renderCard(props: Partial<Parameters<typeof SendCard>[0]> = {}) {
  return render(
    <QueryClientProvider client={clientWith()}>
      <SendCard
        id="bm_1"
        channel="email"
        preview={preview()}
        hours={{ start: 9, end: 20 }}
        blocked={null}
        {...props}
      />
    </QueryClientProvider>
  )
}

/** The re-authentication dialog as the shell's would answer: the app's code. */
function proveWith(secret: string) {
  const asks: ReauthAsk[] = []
  setReauthAsker((ask) => {
    asks.push(ask)
    ask.answer({ method: "totp", secret })
  })
  return asks
}

describe("SendCard (adr/0050 §6–7)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toast.success.mockReset()
  })
  afterEach(() => {
    setReauthAsker(null)
  })

  it("sends now after a confirm and the person proving themselves again", async () => {
    const user = userEvent.setup()
    const asks = proveWith("123456")
    fetchMock
      .mockRejectedValueOnce(refused(428, "staff.reauth_required"))
      .mockResolvedValueOnce({ campaign: campaign({ status: "sending", editable: false }) })
    renderCard()

    await user.click(screen.getByRole("button", { name: "Şimdi gönder" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("1.240 kişiye şimdi gönderilsin mi?")
    await user.click(screen.getByRole("button", { name: "Şimdi gönder" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    expect(asks).toHaveLength(1)
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/admin/bulk-messages/bm_1/send", {
      method: "POST",
      body: {},
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/admin/bulk-messages/bm_1/send", {
      method: "POST",
      body: {},
      headers: { "x-reauth-method": "totp", "x-reauth-secret": "123456" },
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Gönderim başladı; ilk iletiler bir dakika içinde gider."
      )
    })
  })

  it("schedules a time ahead with its offset, proven again", async () => {
    const user = userEvent.setup()
    proveWith("654321")
    fetchMock
      .mockRejectedValueOnce(refused(428))
      .mockResolvedValueOnce({ campaign: campaign({ status: "scheduled", editable: false }) })
    renderCard()
    const local = inDays(2)

    fireEvent.change(screen.getByLabelText("Gönderim zamanı"), { target: { value: local } })
    await user.click(screen.getByRole("button", { name: "Zamanla" }))
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(/için zamanlansın mı\?/)
    await user.click(screen.getByRole("button", { name: "Zamanla" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    const [path, init] = fetchMock.mock.calls[1] as [string, { body: { scheduled_at: string } }]
    expect(path).toBe("/admin/bulk-messages/bm_1/schedule")
    expect(init).toMatchObject({
      method: "POST",
      headers: { "x-reauth-method": "totp", "x-reauth-secret": "654321" },
    })
    expect(init.body.scheduled_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/)
    expect(new Date(init.body.scheduled_at).getTime()).toBe(new Date(local).getTime())
  })

  it("says what is wrong with a time before asking anything", async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getByRole("button", { name: "Zamanla" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Bir tarih ve saat seçin.")
    fireEvent.change(screen.getByLabelText("Gönderim zamanı"), { target: { value: inDays(-1) } })
    await user.click(screen.getByRole("button", { name: "Zamanla" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Gönderim zamanı ileri bir an olmalı.")
    fireEvent.change(screen.getByLabelText("Gönderim zamanı"), { target: { value: inDays(91) } })
    await user.click(screen.getByRole("button", { name: "Zamanla" }))
    expect(screen.getByRole("alert")).toHaveTextContent("en geç 90 gün sonrasına")

    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows the backend's refusal in its own words", async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValueOnce(
      refused(400, "Toplu SMS için önce SMS hesabını bağlayın (Entegrasyonlar).")
    )
    renderCard({ channel: "sms" })

    await user.click(screen.getByRole("button", { name: "Şimdi gönder" }))
    await user.click(await screen.findByRole("button", { name: "Şimdi gönder" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Toplu SMS için önce SMS hesabını bağlayın (Entegrasyonlar)."
    )
  })

  it("says an audience that reaches no one in the backend's words, for a send and a schedule", async () => {
    const user = userEvent.setup()
    const EMPTY =
      "Bu kitlede mesajı alabilecek kimse yok (izin, bastırma listesi ya da 24 saat sınırı). Kitleyi değiştirin."
    fetchMock.mockRejectedValue(refused(400, EMPTY))
    renderCard()

    await user.click(screen.getByRole("button", { name: "Şimdi gönder" }))
    await user.click(await screen.findByRole("button", { name: "Şimdi gönder" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(EMPTY)

    fireEvent.change(screen.getByLabelText("Gönderim zamanı"), { target: { value: inDays(1) } })
    await user.click(screen.getByRole("button", { name: "Zamanla" }))
    await user.click(await screen.findByRole("button", { name: "Zamanla" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/admin/bulk-messages/bm_1/schedule",
        expect.objectContaining({ method: "POST" })
      )
    })
    expect(await screen.findByRole("alert")).toHaveTextContent(EMPTY)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("says nothing went wrong when the person closes the proof dialog", async () => {
    const user = userEvent.setup()
    setReauthAsker((ask) => {
      ask.answer(null)
    })
    fetchMock.mockRejectedValueOnce(refused(428))
    renderCard()

    await user.click(screen.getByRole("button", { name: "Şimdi gönder" }))
    await user.click(await screen.findByRole("button", { name: "Şimdi gönder" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("holds both while something blocks it, and warns a text sent outside its hours waits", () => {
    renderCard({
      channel: "sms",
      blocked: "Kitlede şu an iletiyi alabilecek kimse yok.",
      // 22:00 in Türkiye
      now: new Date("2026-11-03T19:00:00Z"),
    })

    expect(screen.getByRole("button", { name: "Şimdi gönder" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Zamanla" })).toBeDisabled()
    expect(screen.getByText("Kitlede şu an iletiyi alabilecek kimse yok.")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Toplu SMS'ler 09:00–20:00 arasında gider; şimdi gönderirseniz saat 09:00 olunca başlar."
      )
    ).toBeInTheDocument()
  })
})
