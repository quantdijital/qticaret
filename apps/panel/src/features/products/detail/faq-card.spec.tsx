import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { FaqCard } from "./faq-card"

const sdkFetch = vi.hoisted(() => vi.fn())
const netFetch = vi.fn()

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const task = (allowed = true) => ({
  id: "product_faq",
  capability: "text",
  mode: "sync",
  options: [],
  allowed,
  usable: ["deepseek"],
  preference: null,
})

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const ITEMS = [
  { question: "Kaç saat sıcak tutar?", answer: "Gün boyu sıcak tutar." },
  { question: "Hacmi ne kadar?", answer: "750 ml hacimlidir." },
  { question: "Bulaşık makinesinde yıkanır mı?", answer: "Elde yıkanması önerilir." },
]

function setup(options: { allowed?: boolean; addStatus?: number } = {}) {
  sdkFetch.mockImplementation(() =>
    Promise.resolve({ services: [], tasks: [task(options.allowed ?? true)], flags: {} })
  )
  netFetch.mockImplementation((url: string) => {
    if (url.endsWith("/dismiss")) {
      return json(200, { suggestion: { id: "sug_1" } })
    }
    if (url.endsWith("/faq")) {
      return options.addStatus === 400
        ? json(400, { code: "ai.faq_item_invalid", message: "Bu haliyle eklenemez." })
        : json(201, { suggestion: { id: "sug_1", question_ids: ["pq_1", "pq_2"] } })
    }
    return json(201, {
      suggestion: {
        id: "sug_1",
        task: "product_faq",
        service: "deepseek",
        status: "draft",
        text: "{}",
        candidates: ["{}"],
        alternatives: [],
        faq: { items: [...ITEMS, { question: 3, answer: "x" }], dropped: 1 },
      },
    })
  })
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FaqCard productId="prod_1" />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

const BUTTON = "SSS taslağı"

/** Folded like the page's other seldom parts: opened, then the draft asked for. */
async function openDraft(user: ReturnType<typeof userEvent.setup>) {
  const fold = await screen.findByRole("button", { name: "Sık sorulan sorular" })
  expect(fold).toHaveAttribute("aria-expanded", "false")
  await user.click(fold)
  await user.click(screen.getByRole("button", { name: BUTTON }))
}
const posted = () => netFetch.mock.calls.map(([url]) => String(url))
const bodyOf = (url: string) =>
  JSON.parse(
    (netFetch.mock.calls.find(([each]) => String(each) === url)?.[1] as { body: string }).body
  ) as unknown

beforeEach(() => {
  sdkFetch.mockReset()
  netFetch.mockReset()
  vi.mocked(toast.success).mockReset()
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("FaqCard (adr/0074 §5 madde 4)", () => {
  it("lists the draft's items, editable and kept, and adds the kept ones as edited", async () => {
    const user = setup()
    await openDraft(user)

    const questions = await screen.findAllByLabelText("Soru")
    expect(questions.map((each) => (each as HTMLInputElement).value)).toEqual(
      ITEMS.map((each) => each.question)
    )
    expect(bodyOf("/admin/ai/suggestions")).toEqual({
      task: "product_faq",
      entity_type: "product",
      entity_id: "prod_1",
    })

    await user.click(screen.getByRole("checkbox", { name: "3. soruyu ekle" }))
    const answer = screen.getAllByLabelText("Yanıt")[0] as HTMLTextAreaElement
    await user.clear(answer)
    await user.type(answer, "Yaklaşık 12 saat sıcak tutar.")
    await user.click(screen.getByRole("button", { name: "Seçilenleri ekle (2)" }))

    await waitFor(() => {
      expect(posted()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/faq"])
    })
    expect(bodyOf("/admin/ai/suggestions/sug_1/faq")).toEqual({
      items: [
        { q: "Kaç saat sıcak tutar?", a: "Yaklaşık 12 saat sıcak tutar." },
        { q: "Hacmi ne kadar?", a: "750 ml hacimlidir." },
      ],
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("2 soru ürün sayfasına eklendi.")
    })
    expect(screen.queryByLabelText("Soru")).not.toBeInTheDocument()
  })

  it("holds an item the server would refuse, and shows the server's refusal", async () => {
    const user = setup({ addStatus: 400 })
    await openDraft(user)
    const question = (await screen.findAllByLabelText("Soru"))[0] as HTMLInputElement
    await user.clear(question)
    await user.type(question, "Kaç saat sıcak tutar")

    expect(screen.getByText("Soru, soru işaretiyle bitmeli.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Seçilenleri ekle (3)" })).toBeDisabled()

    await user.type(question, "?")
    await user.click(screen.getByRole("button", { name: "Seçilenleri ekle (3)" }))
    expect(await screen.findByText("Bu haliyle eklenemez.")).toBeInTheDocument()
    expect(screen.getAllByLabelText("Soru")).toHaveLength(3)
  })

  it("dismisses the draft on Vazgeç, the cancel kind", async () => {
    const user = setup()
    await openDraft(user)
    await screen.findAllByLabelText("Soru")
    const close = screen.getByRole("button", { name: "Vazgeç" })
    expect(close.className).toMatch(/destructive|red/)
    await user.click(close)
    await waitFor(() => {
      expect(posted()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/dismiss"])
    })
    expect(screen.queryByLabelText("Soru")).not.toBeInTheDocument()
  })

  it("draws nothing for a role the task does not allow", async () => {
    setup({ allowed: false })
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/services")
    })
    expect(screen.queryByRole("button", { name: BUTTON })).not.toBeInTheDocument()
    expect(screen.queryByText("Sık sorulan sorular")).not.toBeInTheDocument()
  })
})
