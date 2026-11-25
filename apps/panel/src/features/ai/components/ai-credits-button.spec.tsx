import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AiCreditsWallet } from "@/features/ai/api/credits"
import { PACK, wallet } from "@/features/settings/components/ai-credits.fixtures"
import { AiButton } from "./ai-button"

const sdkFetch = vi.hoisted(() => vi.fn())
const staff = vi.hoisted(() => ({ role: "owner" }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: () => staff.role === "owner",
  useStaff: () => staff,
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const netFetch = vi.fn()
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const services = (usable: string[]) => ({
  services: [],
  tasks: [
    {
      id: "seo_title",
      capability: "text",
      mode: "sync",
      options: [],
      allowed: true,
      usable,
      preference: null,
    },
  ],
  flags: { own_keys: true },
})

const draft = (service: string) => ({
  suggestion: {
    id: "sug_1",
    task: "seo_title",
    service,
    status: "draft",
    text: "Çelik şef bıçağı 20 cm",
    problems: [],
    alternatives: [],
  },
})

function setup(usable: string[], cost = 3, changes: Partial<AiCreditsWallet> = {}) {
  sdkFetch.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/ai/credits"
        ? wallet({ tasks: { seo_title: cost }, ...changes })
        : services(usable)
    )
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AiButton task="seo_title" entity={{ type: "product", id: "prod_1" }} onUse={vi.fn()} />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
}

const failWith = (key: string, status = 409) => {
  netFetch.mockImplementation(() => json(status, { type: "error", message: key }))
}

beforeEach(() => {
  staff.role = "owner"
  sdkFetch.mockReset()
  netFetch.mockReset()
  netFetch.mockImplementation(() => json(201, draft("platform")))
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("AiButton on the platform's credits", () => {
  it("says a task's price on the platform when dearer than one credit", async () => {
    const user = setup(["platform"], 3)
    await open(user)
    expect(await screen.findByText("3 kredi")).toBeInTheDocument()
    expect(await screen.findByText("Yapay zekâ önerisi · Platform kredisi")).toBeInTheDocument()
  })

  it("says nothing of a one-credit task", async () => {
    const user = setup(["platform"], 1)
    await open(user)
    await screen.findByText("Çelik şef bıçağı 20 cm")
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/credits")
    })
    expect(screen.queryByText(/\d+ kredi$/)).toBeNull()
  })

  it("says nothing of credits, nor reads them, on the shop's own service", async () => {
    netFetch.mockImplementation(() => json(201, draft("deepseek")))
    const user = setup(["deepseek", "platform"], 3)
    await open(user)
    await screen.findByText("Çelik şef bıçağı 20 cm")
    expect(screen.getByRole("radio", { name: "Platform kredisi" })).toBeInTheDocument()
    expect(screen.queryByText("3 kredi")).toBeNull()
    expect(sdkFetch).not.toHaveBeenCalledWith("/admin/ai/credits")
  })

  it("never reads the wallet for a role that may not, nor says a price", async () => {
    staff.role = "operations"
    const user = setup(["platform"], 3)
    await open(user)
    await screen.findByText("Çelik şef bıçağı 20 cm")
    expect(screen.queryByText("3 kredi")).toBeNull()
    expect(sdkFetch).not.toHaveBeenCalledWith("/admin/ai/credits")
  })

  it("tells a role that may not read the wallet to let the owner know, asking nothing", async () => {
    staff.role = "operations"
    failWith("ai.credits_exhausted", 402)
    const user = setup(["platform"])
    await open(user)
    expect(await screen.findByText("Krediniz bitti.")).toBeInTheDocument()
    expect(screen.getByText("Mağaza sahibine haber verin.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Kredi yükle" })).toBeNull()
    expect(sdkFetch).not.toHaveBeenCalledWith("/admin/ai/credits")
  })

  it("offers the owner Kredi yükle when the credits ran out, opening the dialog", async () => {
    failWith("ai.credits_exhausted", 402)
    const user = setup(["platform"])
    await open(user)
    expect(await screen.findByText("Krediniz bitti.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Kredi yükle" }))
    expect(await screen.findByRole("dialog", { name: "Kredi yükle" })).toBeInTheDocument()
  })

  it("tells the owner a request is on its way in place of Kredi yükle", async () => {
    failWith("ai.credits_exhausted", 402)
    const pending_order = {
      id: "aicord_01",
      pack_id: PACK.id,
      credits: PACK.credits,
      amount: PACK.amount,
      currency: PACK.currency,
      status: "pending",
      requested_at: "2026-11-25T10:00:00.000Z",
    }
    const user = setup(["platform"], 3, { pending_order })
    await open(user)
    expect(await screen.findByText("Krediniz bitti.")).toBeInTheDocument()
    expect(
      await screen.findByText("Bekleyen talebiniz var; ödeme onaylanınca krediniz yüklenir.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Kredi yükle" })).toBeNull()
  })

  it("tells anyone but the owner to let the owner know", async () => {
    staff.role = "admin"
    failWith("ai.credits_exhausted", 402)
    const user = setup(["platform"])
    await open(user)
    expect(await screen.findByText("Krediniz bitti.")).toBeInTheDocument()
    expect(screen.getByText("Mağaza sahibine haber verin.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Kredi yükle" })).toBeNull()
  })

  it.each([
    ["ai.credits_daily_cap", "Bugünkü sınıra ulaşıldı. Yarın yeniden deneyebilirsiniz."],
    ["ai.platform_busy", "Şu an yoğun, biraz sonra yeniden deneyin."],
    ["ai.platform_unavailable", "Platform kredisi şu an kullanılamıyor."],
    [
      "ai.service_unavailable",
      "Seçilen servis artık bu işi yapamıyor. Listeden başka bir servis seçin.",
    ],
  ])("says %s in the panel's words", async (key, words) => {
    failWith(key)
    const user = setup(["platform"])
    await open(user)
    expect(await screen.findByText(words)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Kredi yükle" })).toBeNull()
  })
})
