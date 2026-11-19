import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AiBackgroundDialog } from "@/features/ai/components/ai-background-dialog"
import { AiSuggestionBox } from "@/features/ai/components/ai-suggestion-box"

/**
 * A used-up quota (`ai.provider_quota`): a 429 whose body says the
 * account's quota for the job is used up or zero, told apart from a busy
 * service. The panel says so with the service's name and, as for a busy
 * service, offers the other services that can do the job.
 */

const sdkFetch = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))

const QUOTA = /Gemini hesabınızın kotası bu iş için yetmiyor/

const service = (id: string, backgrounds: string[]) => ({
  id,
  capabilities: ["image_edit"],
  status: "connected",
  funding: "own_key",
  data_note_key: `ai.data_note.${id}`,
  backgrounds,
})
const SERVICES = {
  services: [service("gemini", ["white"]), service("photoroom", ["transparent", "white"])],
  tasks: [
    {
      id: "image_background",
      capability: "image_edit",
      mode: "job",
      options: ["transparent", "white"],
      allowed: true,
      usable: ["gemini", "photoroom"],
      preference: "gemini",
    },
  ],
  flags: { own_keys: true },
}

const failedWith = (key: string) => ({
  id: "job_1",
  status: "succeeded",
  progress: 100,
  error_code: null,
  result_summary: { done: [], failed: [{ media_id: "media_01", key }], skipped: 0 },
})
const RUNNING = { ...failedWith("ai.provider_quota"), status: "running", result_summary: null }

const netFetch = vi.fn()
let job: unknown = failedWith("ai.provider_quota")
const bodies = (): unknown[] =>
  netFetch.mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body) as unknown)

beforeEach(() => {
  job = failedWith("ai.provider_quota")
  netFetch.mockReset()
  netFetch.mockImplementation((_url: string, init: { body: string }) => {
    const asked = JSON.parse(init.body) as { service?: string }
    return Promise.resolve(
      new Response(JSON.stringify({ job_id: "job_1", service: asked.service ?? "gemini" }), {
        status: 202,
      })
    )
  })
  vi.stubGlobal("fetch", netFetch)
  sdkFetch.mockReset()
  sdkFetch.mockImplementation((url: string) => {
    if (url === "/admin/ai/services") {
      return Promise.resolve(SERVICES)
    }
    return Promise.resolve({ async_job: job })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function dialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AiBackgroundDialog
        open
        onOpenChange={vi.fn()}
        source={{ id: "media_01", url: "https://cdn.example.com/kupa.webp" }}
        useNote="Kullan, yeni görseli ürüne ekler."
        onUse={vi.fn()}
      />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

describe("a used-up quota in the picture dialog", () => {
  it("says the quota does not cover the job and offers the other service", async () => {
    const user = dialog()
    const box = await screen.findByRole("dialog", { name: "Görseli düzenle" })
    await user.click(await within(box).findByRole("button", { name: "Arka planı temizle" }))
    expect(await within(box).findByRole("alert")).toHaveTextContent(QUOTA)
    const others = within(box).getByRole("group", { name: "Başka servisle dene" })
    expect(within(others).queryByRole("button", { name: "Gemini ile dene" })).toBeNull()

    job = RUNNING
    await user.click(within(others).getByRole("button", { name: "Photoroom ile dene" }))
    await waitFor(() => {
      expect(bodies()[1]).toMatchObject({ option: "white", service: "photoroom" })
    })
    expect(within(box).queryByRole("group", { name: "Başka servisle dene" })).toBeNull()
  })

  it("offers the other service for a busy one too", async () => {
    job = failedWith("ai.provider_busy")
    const user = dialog()
    const box = await screen.findByRole("dialog", { name: "Görseli düzenle" })
    await user.click(await within(box).findByRole("button", { name: "Arka planı temizle" }))
    expect(await within(box).findByRole("alert")).toHaveTextContent("Gemini şu an yoğun")
    expect(within(box).getByRole("button", { name: "Photoroom ile dene" })).toBeInTheDocument()
  })
})

describe("a used-up quota in a suggestion", () => {
  it("says it in the service's name and offers the services the backend named", async () => {
    const onTryWith = vi.fn()
    render(
      <AiSuggestionBox
        state={{
          status: "error",
          failure: { code: "ai.provider_quota", message: "ai.provider_quota" },
          service: "gemini",
          alternatives: ["deepseek"],
        }}
        onUse={vi.fn()}
        onRetry={vi.fn()}
        onTryWith={onTryWith}
        onDismiss={vi.fn()}
      />
    )
    expect(screen.getByText(QUOTA)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole("button", { name: "DeepSeek ile dene" }))
    expect(onTryWith).toHaveBeenCalledWith("deepseek")
  })
})
