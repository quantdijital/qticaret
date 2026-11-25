import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AdvisorKind, Assessment, SeoIssue } from "@/features/seo/api/advisor"
import { SeoCard } from "@/features/seo/components/seo-card"
import { AdvisorCard } from "./advisor-card"
import { clearAiFills, sendAiFill, useAiFill } from "./ai-fill"

/**
 * "Yapay zekâyla düzelt" on an advisor finding (docs/22 "Aşama 3"): the
 * shared AI button on the findings an AI task fixes; "Kullan" puts the
 * text in the record's SEO form as an unsaved change and takes the person
 * to it. Nothing is written until the form's own Save (adr/0005).
 */

const sdkFetch = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const ai = vi.hoisted(() => ({ tasks: [] as unknown[] }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("sonner", () => ({ toast }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true, useStaff: () => undefined }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const SUGGESTED = "Keten Gömlek Yazlık Model ve Rahat Kesim | Örnek Mağaza"
const TITLE_FINDING = "Arama sonucu başlığı 6 karakter; 30–60 arası önerilir."
const BUTTON = `Yapay zekâyla düzelt: ${TITLE_FINDING}`

const issue = (ruleId: string, extra: Partial<SeoIssue> = {}): SeoIssue => ({
  ruleId,
  severity: "high",
  category: "meta",
  params: { length: 6, min: 30, max: 60, count: 1, target: 3, words: 2 },
  ...extra,
})

const TITLE = issue("P-TITLE-01", {
  fix: { kind: "manual", action: "edit_title" },
  ai: { task: "seo_title", field: "seo_title" },
})

const offer = (usable: string[], allowed = true) => {
  ai.tasks = ["seo_title", "seo_description"].map((id) => ({
    id,
    capability: "text",
    mode: "sync",
    options: [],
    allowed,
    usable,
    preference: null,
  }))
}

const net = vi.fn()
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

function renderPage(issues: SeoIssue[], kind: AdvisorKind = "product", withForm = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  const assessment: Assessment = {
    score: 60,
    grade: "needs_work",
    issues,
    categories: {},
    weights: { structured: 25, meta: 15, images: 20, content: 20, links: 10, technical: 10 },
  }
  client.setQueryData(["seo", "assessment", kind, "prod_1", null], assessment)
  client.setQueryData(["seo-meta", "product", "prod_1"], {
    seo_title: "Gömlek",
    seo_description: null,
    focus_keyword: null,
    canonical_override: null,
    robots_override: null,
  })
  const onTarget = vi.fn()
  const view = render(
    <QueryClientProvider client={client}>
      <AdvisorCard
        kind={kind}
        id="prod_1"
        targets={{
          edit_title: "product-seo",
          edit_description: "product-seo",
          edit_body: "product-description",
        }}
        onTarget={onTarget}
      />
      {withForm ? (
        <SeoCard
          type="product"
          id="prod_1"
          context={{ path: "/urun/gomlek", tokens: {}, fallbackDescription: "" }}
        />
      ) : null}
    </QueryClientProvider>
  )
  return { ...view, onTarget, user: userEvent.setup() }
}

const saves = () =>
  sdkFetch.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method)

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  offer(["deepseek"])
  sdkFetch.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/ai/services"
        ? { services: [], tasks: ai.tasks, flags: { own_keys: true } }
        : { values: { title_templates: {}, description_templates: {}, canonical_host: null } }
    )
  )
  net.mockImplementation((url: string) =>
    url.endsWith("/accept")
      ? json(200, { suggestion: { id: "sug_1", text: SUGGESTED } })
      : json(201, {
          suggestion: {
            id: "sug_1",
            task: "seo_title",
            service: "deepseek",
            status: "draft",
            text: SUGGESTED,
            problems: [],
            alternatives: [],
          },
        })
  )
  vi.stubGlobal("fetch", net)
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearAiFills("product", "prod_1")
})

describe("IssueAiFix", () => {
  it("names the finding on its button, beside the way to the field", async () => {
    renderPage([TITLE, issue("P-IMG-01", { category: "images" })])
    const button = await screen.findByRole("button", { name: BUTTON })
    expect(button).toHaveTextContent("Yapay zekâyla düzelt")
    expect(screen.getByRole("button", { name: "Alana git" })).toBeInTheDocument()
    // One finding fixed by a task, one button
    expect(screen.getAllByRole("button", { name: /^Yapay zekâyla düzelt/ })).toHaveLength(1)
  })

  it("puts the suggestion in the SEO form unsaved and takes the person to it", async () => {
    const { user, onTarget } = renderPage([TITLE])
    await user.click(await screen.findByRole("button", { name: BUTTON }))
    await user.click(await screen.findByRole("button", { name: "Kullan" }))

    await waitFor(() => {
      expect(document.getElementById("seo-title-prod_1")).toHaveValue(SUGGESTED)
    })
    expect(onTarget).toHaveBeenCalledWith("product-seo")
    expect(toast.success).toHaveBeenCalledWith("Öneri alana kondu; kaydedince geçerli olur.")
    // Only the suggestion and the decision were sent; the record is written by Save alone
    expect(net.mock.calls.map(([url]) => String(url))).toEqual([
      "/admin/ai/suggestions",
      "/admin/ai/suggestions/sug_1/accept",
    ])
    expect(saves()).toEqual([])
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeEnabled()
  })

  it("asks for a detailed product description and hands it to the description editor", async () => {
    ai.tasks = [
      {
        id: "product_description",
        capability: "text",
        mode: "sync",
        options: ["short", "detailed"],
        allowed: true,
        usable: ["deepseek"],
        preference: null,
      },
    ]
    const { user, onTarget } = renderPage(
      [
        issue("P-CONT-01", {
          category: "content",
          ai: { task: "product_description", field: "description", option: "detailed" },
        }),
      ],
      "product",
      false
    )
    await user.click(
      await screen.findByRole("button", {
        name: "Yapay zekâyla düzelt: Metin 2 kelime; en az 30 önerilir.",
      })
    )
    await user.click(await screen.findByRole("button", { name: "Kullan" }))
    const body = JSON.parse((net.mock.calls[0]?.[1] as { body: string }).body) as unknown
    expect(body).toEqual({
      task: "product_description",
      entity_type: "product",
      entity_id: "prod_1",
      option: "detailed",
    })
    expect(onTarget).toHaveBeenCalledWith("product-description")
    // The editor drawn later takes it (description-card-ai.spec.tsx draws the card itself)
    const taken = vi.fn()
    function Editor() {
      useAiFill("product", "prod_1", "description", taken)
      return null
    }
    render(<Editor />)
    expect(taken).toHaveBeenCalledWith(SUGGESTED)
    expect(saves()).toEqual([])
  })

  it("draws nothing on a landing page's finding, even one a task names", async () => {
    renderPage([TITLE], "landing", false)
    await screen.findByText(TITLE_FINDING)
    expect(screen.queryByRole("button", { name: /Yapay zekâyla düzelt/ })).not.toBeInTheDocument()
  })

  it("leaves the finding without it for a role the task does not allow", async () => {
    offer(["deepseek"], false)
    renderPage([TITLE], "product", false)
    await screen.findByText(TITLE_FINDING)
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/services")
    })
    expect(screen.queryByRole("button", { name: BUTTON })).not.toBeInTheDocument()
  })

  it("opens the connect hint behind the same button when no service is usable", async () => {
    offer([])
    const { user } = renderPage([TITLE], "product", false)
    await user.click(await screen.findByRole("button", { name: BUTTON }))
    expect(await screen.findByRole("dialog", { name: BUTTON })).toBeInTheDocument()
    expect(net).not.toHaveBeenCalled()
  })
})

describe("ai-fill", () => {
  it("keeps a suggestion for a form not drawn yet and drops it once the page is left", async () => {
    sendAiFill("product", "prod_1", "seo_title", SUGGESTED)
    const first = renderPage([], "product")
    await waitFor(() => {
      expect(document.getElementById("seo-title-prod_1")).toHaveValue(SUGGESTED)
    })
    first.unmount()

    sendAiFill("product", "prod_1", "seo_title", "Bırakılan öneri")
    clearAiFills("product", "prod_1")
    renderPage([], "product")
    await waitFor(() => {
      expect(document.getElementById("seo-title-prod_1")).toHaveValue("Gömlek")
    })
  })
})
