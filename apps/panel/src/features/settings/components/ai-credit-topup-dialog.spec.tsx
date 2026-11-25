import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AiCreditTopupDialog } from "./ai-credit-topup-dialog"
import { PACK, wallet } from "./ai-credits.fixtures"

const sdkFetch = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))

const netFetch = vi.fn()
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const ORDER = {
  order: {
    id: "aicord_01",
    pack_id: PACK.id,
    credits: 500,
    amount: 25_000,
    currency: "TRY",
    status: "pending",
    requested_at: "2026-11-25T10:00:00.000Z",
  },
}

function setup(answer: unknown = wallet()) {
  sdkFetch.mockResolvedValue(answer)
  const onClose = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AiCreditTopupDialog onClose={onClose} />
    </QueryClientProvider>
  )
  return { onClose, user: userEvent.setup() }
}

const dialog = () => screen.findByRole("dialog", { name: "Kredi yükle" })
const submit = () => screen.getByRole("button", { name: "Talep gönder" })

beforeEach(() => {
  sdkFetch.mockReset()
  netFetch.mockReset()
  vi.stubGlobal("fetch", netFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("AiCreditTopupDialog", () => {
  it("lists the server's packs as they come: the name as plain text, credits, price", async () => {
    setup(wallet({ packs: [PACK, { ...PACK, id: "pack-2000", name: "Büyük", credits: 2000 }] }))
    const box = await dialog()
    expect(box).toHaveAccessibleDescription(/ödeme bilgisi için sizinle iletişime geçeriz/)
    const radios = await within(box).findAllByRole("radio")
    expect(radios).toHaveLength(2)
    // Plain text: the markup in a name is shown, never drawn
    expect(within(box).getByText("500 kredi <b>paketi</b>")).toBeInTheDocument()
    expect(box.querySelector("b")).toBeNull()
    expect(within(box).getAllByText("₺250,00")).toHaveLength(2)
    expect(within(box).getByText("2.000 kredi")).toBeInTheDocument()
    expect(radios[0]).toBeChecked()
  })

  it("sends the pack's id alone, locked while on its way, and closes once received", async () => {
    let answer: (value: Response) => void = () => undefined
    netFetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        })
    )
    const { onClose, user } = setup()
    await dialog()
    await screen.findByRole("radio")
    await user.click(submit())
    await waitFor(() => {
      expect(submit()).toBeDisabled()
    })
    expect(screen.getByRole("button", { name: "Vazgeç" })).toBeDisabled()
    await user.click(submit())
    expect(netFetch).toHaveBeenCalledTimes(1)
    const [url, init] = netFetch.mock.calls[0] as [string, { method: string; body: string }]
    expect([url, init.method]).toEqual(["/admin/ai/credits/orders", "POST"])
    expect(JSON.parse(init.body)).toEqual({ pack_id: PACK.id })

    answer(new Response(JSON.stringify(ORDER), { status: 201 }))
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it.each([
    ["ai.credits_order_open", 409, "Bekleyen bir talebiniz var."],
    ["ai.platform_unavailable", 502, "Platform kredisi şu an kullanılamıyor."],
  ])("says %s in the panel's words", async (key, status, words) => {
    netFetch.mockImplementation(() => json(status, { type: "conflict", message: key }))
    const { onClose, user } = setup()
    await dialog()
    await screen.findByRole("radio")
    await user.click(submit())
    expect(await screen.findByText(words)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Listeyi yenile" })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("says a pack gone and reads the list again on Listeyi yenile", async () => {
    netFetch.mockImplementation(() =>
      json(409, { type: "conflict", message: "ai.credits_pack_unknown" })
    )
    const { user } = setup()
    await dialog()
    await screen.findByRole("radio")
    await user.click(submit())
    expect(
      await screen.findByText("Bu paket artık sunulmuyor; listeyi yenileyin.")
    ).toBeInTheDocument()
    const asked = sdkFetch.mock.calls.length
    await user.click(screen.getByRole("button", { name: "Listeyi yenile" }))
    await waitFor(() => {
      expect(sdkFetch.mock.calls.length).toBeGreaterThan(asked)
    })
    expect(screen.queryByText("Bu paket artık sunulmuyor; listeyi yenileyin.")).toBeNull()
  })

  it("says to write to us with no pack, nothing to send", async () => {
    setup(wallet({ packs: [] }))
    await dialog()
    expect(await screen.findByText("Kredi yüklemek için bize yazın.")).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it("closes on a red Vazgeç, sending nothing", async () => {
    const { onClose, user } = setup()
    await dialog()
    const cancel = screen.getByRole("button", { name: "Vazgeç" })
    // Every Vazgeç is red (docs/18)
    expect(cancel.className).toMatch(/text-destructive-text/)
    await user.click(cancel)
    expect(onClose).toHaveBeenCalled()
    expect(netFetch).not.toHaveBeenCalled()
  })
})
