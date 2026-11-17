import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AiServicesAnswer } from "@/features/ai/api/ai"
import { AiButton } from "./ai-button"

const sdkFetch = vi.hoisted(() => vi.fn())
const can = vi.hoisted(() => ({ owner: true }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => can.owner }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const services = (usable: string[], extra: Partial<AiServicesAnswer["tasks"][number]> = {}) => ({
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
      ...extra,
    },
  ],
  flags: { own_keys: true },
})

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

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

const netFetch = vi.fn()

function setup(answer: unknown) {
  sdkFetch.mockResolvedValue(answer)
  const onUse = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AiButton task="seo_title" entity={{ type: "product", id: "prod_1" }} onUse={onUse} />
    </QueryClientProvider>
  )
  return { onUse, user: userEvent.setup() }
}

const calls = () => netFetch.mock.calls.map(([url]) => String(url))
const bodyOf = (index: number) =>
  JSON.parse((netFetch.mock.calls[index]?.[1] as { body: string }).body) as Record<string, unknown>

beforeEach(() => {
  can.owner = true
  netFetch.mockReset()
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("AiButton", () => {
  it("asks in one click with one service: no picker, no service name sent, the service named", async () => {
    netFetch.mockImplementation(() => json(201, draft("deepseek")))
    const { user } = setup(services(["deepseek"]))
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    expect(await screen.findByText("Çelik şef bıçağı 20 cm")).toBeInTheDocument()
    expect(screen.getByText("Yapay zekâ önerisi · DeepSeek")).toBeInTheDocument()
    expect(screen.queryByRole("radiogroup", { name: "Servis" })).not.toBeInTheDocument()
    expect(bodyOf(0)).toEqual({ task: "seo_title", entity_type: "product", entity_id: "prod_1" })
  })

  it("Kullan hands the text to onUse and only records the decision", async () => {
    netFetch.mockImplementation((url: string) =>
      url.endsWith("/accept")
        ? json(200, { suggestion: { id: "sug_1", text: "Çelik şef bıçağı 20 cm" } })
        : json(201, draft("deepseek"))
    )
    const { user, onUse } = setup(services(["deepseek"]))
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    await user.click(await screen.findByRole("button", { name: "Kullan" }))
    await waitFor(() => {
      expect(onUse).toHaveBeenCalledWith("Çelik şef bıçağı 20 cm")
    })
    expect(calls()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/accept"])
  })

  it("shows the picker with several services and sends the one picked", async () => {
    netFetch.mockImplementation(() => json(201, draft("minimax")))
    const { user } = setup(services(["deepseek", "minimax"], { preference: "minimax" }))
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    const picker = await screen.findByRole("radiogroup", { name: "Servis" })
    expect(bodyOf(0)["service"]).toBe("minimax")
    await screen.findByText("Çelik şef bıçağı 20 cm")
    await user.click(within(picker).getByRole("radio", { name: "DeepSeek" }))
    await waitFor(() => {
      expect(netFetch).toHaveBeenCalledTimes(2)
    })
    expect(bodyOf(1)["service"]).toBe("deepseek")
  })

  it("offers another service on a failure only when the backend names one, and never on its own", async () => {
    netFetch.mockImplementationOnce(() =>
      json(502, {
        type: "provider_error",
        message: "DeepSeek şu an yanıt vermiyor.",
        code: "ai.provider_unavailable",
        provider: "deepseek",
        alternatives: ["minimax"],
      })
    )
    netFetch.mockImplementationOnce(() => json(201, draft("minimax")))
    const { user } = setup(services(["deepseek", "minimax"]))
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    expect(await screen.findByText("DeepSeek şu an yanıt vermiyor.")).toBeInTheDocument()
    expect(netFetch).toHaveBeenCalledTimes(1)
    const other = screen.getByRole("group", { name: "Başka servisle dene" })
    await user.click(within(other).getByRole("button", { name: "MiniMax ile dene" }))
    expect(await screen.findByText("Çelik şef bıçağı 20 cm")).toBeInTheDocument()
    expect(bodyOf(1)["service"]).toBe("minimax")
  })

  it("has no other-service offer when there is none", async () => {
    netFetch.mockImplementation(() =>
      json(502, { message: "x", code: "ai.timeout", provider: "deepseek", alternatives: [] })
    )
    const { user } = setup(services(["deepseek"]))
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    expect(await screen.findByText("DeepSeek zamanında yanıt vermedi.")).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Başka servisle dene" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Kullan" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeEnabled()
  })

  it("says a refusal and asks again on Yeniden dene", async () => {
    netFetch.mockImplementationOnce(() =>
      json(422, { message: "ai.suggestion_refused", problems: [], service: "deepseek" })
    )
    netFetch.mockImplementationOnce(() => json(201, draft("deepseek")))
    const { user } = setup(services(["deepseek"]))
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    expect(await screen.findByText(/Uygun bir öneri çıkmadı/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Yeniden dene" }))
    expect(await screen.findByText("Çelik şef bıçağı 20 cm")).toBeInTheDocument()
  })

  it("closes on Esc, returns focus to the button and records the dismissal", async () => {
    netFetch.mockImplementation(() => json(201, draft("deepseek")))
    const { user } = setup(services(["deepseek"]))
    const button = await screen.findByRole("button", { name: "Yapay zekâ ile öner" })
    await user.click(button)
    await screen.findByText("Çelik şef bıçağı 20 cm")
    await user.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByText("Çelik şef bıçağı 20 cm")).not.toBeInTheDocument()
    )
    expect(button).toHaveFocus()
    expect(calls()).toContain("/admin/ai/suggestions/sug_1/dismiss")
  })

  it("draws nothing for a role the task does not allow", async () => {
    setup(services(["deepseek"], { allowed: false }))
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalled()
    })
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})

describe("AiConnectHint behind the same button", () => {
  it("asks nothing, offers the owner to connect, and stays closed once closed", async () => {
    const { user } = setup(services([]))
    const button = await screen.findByRole("button", { name: "Yapay zekâ ile öner" })
    await user.click(button)
    expect(await screen.findByRole("link", { name: "Bağla" })).toHaveAttribute(
      "href",
      "/settings/ai"
    )
    expect(netFetch).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "İpucunu kapat" }))
    expect(screen.queryByRole("link", { name: "Bağla" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Yapay zekâ ile öner" })).not.toBeInTheDocument()
    expect(window.localStorage.getItem("qt.panel.ai.hint.dismissed")).toBe("1")
  })

  it("tells anyone else the store owner can connect, with no link", async () => {
    can.owner = false
    const { user } = setup(services([]))
    await user.click(await screen.findByRole("button", { name: "Yapay zekâ ile öner" }))
    expect(await screen.findByText(/mağaza sahibi bağlayabilir/)).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("is not drawn when it was closed before", async () => {
    window.localStorage.setItem("qt.panel.ai.hint.dismissed", "1")
    setup(services([]))
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalled()
    })
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
