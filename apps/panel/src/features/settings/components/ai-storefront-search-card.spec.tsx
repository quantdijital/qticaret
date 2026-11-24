import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AiServiceView } from "@/features/ai/api/ai"
import { hasOwnTextKey } from "@/features/settings/ai-own-key"
import { AiStorefrontSearchCard } from "./ai-storefront-search-card"

const fetchMock = vi.hoisted(() => vi.fn())
const staff = vi.hoisted(() => ({ role: "owner" }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@/features/auth/api/staff", () => ({ useStaff: () => staff }))

const FLAG = "/admin/features/ai.storefront_search"

function serve(enabled: boolean) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) =>
    Promise.resolve(
      init?.method === "POST"
        ? { feature: { key: "ai.storefront_search", enabled: !enabled } }
        : {
            features: [{ key: "ai.storefront_search", default: false, owner: "tenant", enabled }],
          }
    )
  )
}

function renderCard(ownKey = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AiStorefrontSearchCard ownKey={ownKey} />
    </QueryClientProvider>
  )
}

const switchOf = () => screen.findByRole("switch", { name: "Kendi cümlesiyle arama" })

/** The switch once the flag is read (disabled while loading). */
async function readySwitch() {
  const toggle = await switchOf()
  await waitFor(() => expect(toggle).toBeEnabled())
  return toggle
}

describe("AiStorefrontSearchCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    staff.role = "owner"
  })

  it("off by default; turning it on asks first, Vazgeç keeps it off", async () => {
    serve(false)
    renderCard()
    const toggle = await readySwitch()
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)

    const dialog = await screen.findByRole("alertdialog", {
      name: "Kendi cümlesiyle arama açılsın mı?",
    })
    expect(dialog).toHaveAccessibleDescription(/yurt dışında olabilir/)
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/ad ve adres her zaman ayıklanamaz/)
    expect(within(dialog).getByText(/KVKK aydınlatma metninize/)).toBeInTheDocument()
    const cancel = within(dialog).getByRole("button", { name: "Vazgeç" })
    // Every Vazgeç is red (docs/18)
    expect(cancel.className).toMatch(/text-destructive-text/)
    fireEvent.click(cancel)

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull()
    })
    expect(fetchMock).not.toHaveBeenCalledWith(FLAG, expect.anything())
  })

  it("confirmed, it goes on through the flag's route", async () => {
    serve(false)
    renderCard()
    fireEvent.click(await readySwitch())
    fireEvent.click(await screen.findByRole("button", { name: "Aç" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(FLAG, { method: "POST", body: { enabled: true } })
    })
  })

  it("going off asks nothing", async () => {
    serve(true)
    renderCard()
    const toggle = await switchOf()
    await waitFor(() => expect(toggle).toBeChecked())
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(FLAG, { method: "POST", body: { enabled: false } })
    })
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("without the shop's own text key it cannot go on, and says why", async () => {
    serve(false)
    renderCard(false)
    const toggle = await switchOf()
    await waitFor(() => expect(toggle).toBeDisabled())
    expect(screen.getByText(/kendi anahtarınızla bir metin servisi bağlayın/)).toBeInTheDocument()
  })

  it("only the owner switches it", async () => {
    staff.role = "admin"
    serve(false)
    renderCard()
    const toggle = await switchOf()
    await waitFor(() => expect(toggle).toBeDisabled())
    expect(screen.getByText(/yalnız mağaza sahibi/)).toBeInTheDocument()
  })
})

describe("hasOwnTextKey", () => {
  const service = (over: Partial<AiServiceView>): AiServiceView => ({
    id: "deepseek",
    capabilities: ["text"],
    status: "connected",
    funding: "own_key",
    data_note_key: "ai.data_note.deepseek",
    ...over,
  })

  it("a connected text service on the shop's own key, while the package allows own keys", () => {
    expect(hasOwnTextKey([service({})], true)).toBe(true)
    expect(hasOwnTextKey([service({})], false)).toBe(false)
    expect(hasOwnTextKey([service({ status: "not_connected" })], true)).toBe(false)
    expect(hasOwnTextKey([service({ funding: "platform_credit" })], true)).toBe(false)
    expect(hasOwnTextKey([service({ capabilities: ["image_edit"] })], true)).toBe(false)
  })
})
