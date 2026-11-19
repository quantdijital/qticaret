import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SeoCard } from "./seo-card"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

// The AI services answer: none of the SEO tasks offered unless a test says so
const ai = vi.hoisted(() => ({
  answer: { services: [], tasks: [] as unknown[], flags: { own_keys: true } },
}))

const EMPTY = {
  seo_title: null,
  seo_description: null,
  focus_keyword: null,
  canonical_override: null,
  robots_override: null,
  og_image_override: null,
  og_image_alt: null,
}

function renderCard(type: "page" | "collection" = "page", saved: object = EMPTY) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(["seo-meta", type, "cent_1"], saved)
  const card = (
    <QueryClientProvider client={client}>
      <SeoCard
        type={type}
        id="cent_1"
        context={{ path: "/hakkimizda", tokens: { başlık: "Hakkımızda" }, fallbackDescription: "" }}
      />
    </QueryClientProvider>
  )
  const view = render(card)
  return { ...view, again: () => render(card) }
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement

/** The owner, 2026-11-04: the SEO fields are all optional and a save is never refused for length. */
describe("SeoCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === "/admin/ai/services"
          ? ai.answer
          : url.startsWith("/admin/seo/")
            ? { seo: EMPTY, duplicates: { seo_title: 0, seo_description: 0 } }
            : // The shop's SEO settings: no templates written
              {
                values: { title_templates: {}, description_templates: {}, canonical_host: null },
              }
      )
    )
  })

  it("stops typing at what the server keeps instead of refusing the save", async () => {
    const user = userEvent.setup()
    renderCard()

    expect(field("seo-title-cent_1")).toHaveAttribute("maxLength", "150")
    expect(field("seo-description-cent_1")).toHaveAttribute("maxLength", "320")
    expect(field("seo-keyword-cent_1")).toHaveAttribute("maxLength", "100")
    await user.click(field("seo-description-cent_1"))
    await user.paste("a".repeat(400))
    expect(field("seo-description-cent_1").value).toHaveLength(320)
  })

  it("saves a pasted long description cut to what the server keeps", async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(field("seo-description-cent_1"))
    await user.paste("a".repeat(400))
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/seo/page/cent_1", {
      method: "PUT",
      body: { seo_description: "a".repeat(320) },
    })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("folds on a content page to the fields' lengths and the advisor's findings", async () => {
    const user = userEvent.setup()
    localStorage.clear()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(["seo-meta", "page", "cent_1"], {
      ...EMPTY,
      seo_title: "Kupa seçme rehberi",
    })
    render(
      <QueryClientProvider client={client}>
        <SeoCard
          type="page"
          id="cent_1"
          context={{ path: "/kupa", tokens: {}, fallbackDescription: "Kupalar hakkında" }}
          collapse={{ id: "content-seo", name: "content.seo", note: "2 öneri" }}
        />
      </QueryClientProvider>
    )
    const toggle = screen.getByRole("button", { name: "Arama motoru görünümü" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(toggle).toHaveAccessibleDescription(
      "Başlık 18/60 · Açıklama (otomatik) 16/155 · 2 öneri"
    )
    expect(screen.queryByRole("textbox", { name: "SEO başlığı" })).not.toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByRole("textbox", { name: "SEO başlığı" })).toHaveValue("Kupa seçme rehberi")
  })

  /** adr/0071 §13, docs/22 PR 1-2: "Kullan" fills the field, only the card's Save writes it. */
  describe("AI suggestions", () => {
    const SUGGESTED = "Kupa seçme rehberi ve bakım ipuçları"
    const net = vi.fn()
    const offer = (usable: string[]) => {
      ai.answer.tasks = ["seo_title", "seo_description", "focus_keyword"].map((id) => ({
        id,
        capability: "text",
        mode: "sync",
        options: [],
        allowed: true,
        usable,
        preference: null,
      }))
    }
    const json = (status: number, body: unknown) =>
      Promise.resolve(new Response(JSON.stringify(body), { status }))
    const urls = () => net.mock.calls.map(([url]) => String(url))
    const seoWrites = () =>
      fetchMock.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method)
    // Each button says its field (two of one name would be the same to a screen reader)
    const titleButton = () =>
      screen.findByRole("button", { name: "Başlık için yapay zekâ ile öner" })

    beforeEach(() => {
      localStorage.clear()
      net.mockReset()
      net.mockImplementation((url: string) =>
        url.endsWith("/accept")
          ? json(200, { suggestion: { id: "sug_1", text: SUGGESTED } })
          : url.endsWith("/dismiss")
            ? json(200, {})
            : json(201, {
                suggestion: {
                  id: "sug_1",
                  task: "seo_title",
                  service: "deepseek",
                  text: SUGGESTED,
                },
              })
      )
      vi.stubGlobal("fetch", net)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
      ai.answer.tasks = []
    })

    it("puts the suggestion in the form, the preview and the counter; Save writes it, nothing before", async () => {
      offer(["deepseek"])
      const user = userEvent.setup()
      renderCard()

      await user.click(await titleButton())
      await user.click(await screen.findByRole("button", { name: "Kullan" }))
      await waitFor(() => {
        expect(field("seo-title-cent_1")).toHaveValue(SUGGESTED)
      })
      expect(screen.getAllByText(SUGGESTED)[0]).toBeInTheDocument()
      expect(screen.getByText(`${SUGGESTED.length}/60`)).toBeInTheDocument()
      expect(urls()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/accept"])
      expect(JSON.parse((net.mock.calls[0]?.[1] as { body: string }).body)).toEqual({
        task: "seo_title",
        entity_type: "page",
        entity_id: "cent_1",
      })
      expect(seoWrites()).toEqual([])

      await user.click(screen.getByRole("button", { name: "Kaydet" }))
      expect(fetchMock).toHaveBeenCalledWith("/admin/seo/page/cent_1", {
        method: "PUT",
        body: { seo_title: SUGGESTED },
      })
    })

    it("keeps the old value on Vazgeç and writes nothing", async () => {
      offer(["deepseek"])
      const user = userEvent.setup()
      renderCard("page", { ...EMPTY, seo_title: "Eski başlık" })

      await user.click(await titleButton())
      await screen.findByText(SUGGESTED)
      await user.click(screen.getByRole("button", { name: "Vazgeç" }))
      await waitFor(() => {
        expect(screen.queryByText(SUGGESTED)).not.toBeInTheDocument()
      })
      expect(field("seo-title-cent_1")).toHaveValue("Eski başlık")
      expect(urls()).toContain("/admin/ai/suggestions/sug_1/dismiss")
      expect(seoWrites()).toEqual([])
    })

    it("drops a used suggestion that was not saved when the card is left", async () => {
      offer(["deepseek"])
      const user = userEvent.setup()
      const view = renderCard("page", { ...EMPTY, seo_title: "Eski başlık" })

      await user.click(await titleButton())
      await user.click(await screen.findByRole("button", { name: "Kullan" }))
      await waitFor(() => {
        expect(field("seo-title-cent_1")).toHaveValue(SUGGESTED)
      })
      view.unmount()
      view.again()
      expect(field("seo-title-cent_1")).toHaveValue("Eski başlık")
      expect(seoWrites()).toEqual([])
    })

    it("offers to connect a service when there is none, and asks nothing", async () => {
      offer([])
      const user = userEvent.setup()
      renderCard()

      await user.click(await titleButton())
      expect(await screen.findByRole("link", { name: "Bağla" })).toHaveAttribute(
        "href",
        "/settings/ai"
      )
      expect(net).not.toHaveBeenCalled()
    })

    it("shows the service picker with two services", async () => {
      offer(["deepseek", "minimax"])
      const user = userEvent.setup()
      renderCard()

      await user.click(await titleButton())
      const picker = await screen.findByRole("radiogroup", { name: "Servis" })
      expect(within(picker).getAllByRole("radio")).toHaveLength(2)
    })

    it("names each button by its field and fills the description from its own", async () => {
      offer(["deepseek"])
      const user = userEvent.setup()
      renderCard()

      expect(await titleButton()).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Açıklama için yapay zekâ ile öner" }))
      await user.click(await screen.findByRole("button", { name: "Kullan" }))
      await waitFor(() => {
        expect(field("seo-description-cent_1")).toHaveValue(SUGGESTED)
      })
      expect(field("seo-title-cent_1")).toHaveValue("")
      expect(JSON.parse((net.mock.calls[0]?.[1] as { body: string }).body)).toMatchObject({
        task: "seo_description",
      })
    })

    it("fills the focus keyword with the choice picked among its alternatives", async () => {
      offer(["deepseek"])
      net.mockImplementation(() =>
        json(201, {
          suggestion: {
            id: "sug_1",
            task: "focus_keyword",
            service: "deepseek",
            text: "keten gömlek\nyazlık keten gömlek",
          },
        })
      )
      const user = userEvent.setup()
      renderCard()

      await user.click(
        await screen.findByRole("button", { name: "Odak anahtar kelime için yapay zekâ ile öner" })
      )
      await user.click(await screen.findByRole("button", { name: "Kullan: yazlık keten gömlek" }))
      await waitFor(() => {
        expect(field("seo-keyword-cent_1")).toHaveValue("yazlık keten gömlek")
      })
      expect(JSON.parse((net.mock.calls[0]?.[1] as { body: string }).body)).toEqual({
        task: "focus_keyword",
        entity_type: "page",
        entity_id: "cent_1",
      })
      expect(seoWrites()).toEqual([])
      await user.click(screen.getByRole("button", { name: "Kaydet" }))
      expect(fetchMock).toHaveBeenCalledWith("/admin/seo/page/cent_1", {
        method: "PUT",
        body: { focus_keyword: "yazlık keten gömlek" },
      })
    })

    it("has no button on a card the AI core does not write for", () => {
      offer(["deepseek"])
      renderCard("collection")
      expect(field("seo-title-cent_1")).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalledWith("/admin/ai/services")
      expect(screen.queryByRole("button", { name: /yapay zekâ ile öner/i })).not.toBeInTheDocument()
    })
  })
})
