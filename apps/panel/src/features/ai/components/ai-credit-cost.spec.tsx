import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactElement, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { wallet } from "@/features/settings/components/ai-credits.fixtures"
import { AltReviewStart } from "@/features/media/components/alt-review-start"
import { SeoFillStart } from "@/features/seo/advisor/seo-fill-start"
import { AiBackgroundDialog } from "./ai-background-dialog"
import { AiCreditCost } from "./ai-credit-cost"

/**
 * P5b: "bu iş N kredi" beside the picture dialog and the bulk jobs, as
 * beside the AI button: the wallet's table, the platform chosen, a role
 * that may read the wallet. A bulk job says per item and at most.
 */

const sdkFetch = vi.hoisted(() => vi.fn())
const staff = vi.hoisted(() => ({ role: "owner", read: 0 }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: () => true,
  useStaff: () => {
    staff.read += 1
    return { role: staff.role }
  },
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const TASKS = { image_background: 10, image_scene: 40, image_alt_text: 2, seo_title: 1 }
const SEO = { seo_title: 1, seo_description: 1 }
const imageTask = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  capability: "image_edit",
  mode: "job",
  options: ["white"],
  allowed: true,
  usable: ["platform"],
  preference: null,
  ...extra,
})
const SERVICES = {
  services: [
    {
      id: "platform",
      capabilities: ["image_edit"],
      status: "connected",
      funding: "platform_credit",
      data_note_key: "ai.data_note.platform",
      backgrounds: ["white"],
      scene: true,
    },
  ],
  tasks: [
    imageTask("image_background"),
    imageTask("image_scene", {
      options: ["studio"],
      scenes: [{ code: "studio", name: { tr: "Stüdyo", en: "Studio" } }],
    }),
  ],
  flags: { own_keys: true },
}

function show(ui: ReactElement, tasks: Record<string, number> = { ...TASKS, ...SEO }) {
  sdkFetch.mockImplementation((url: string) =>
    Promise.resolve(url === "/admin/ai/credits" ? wallet({ tasks }) : SERVICES)
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const askedWallet = () => sdkFetch.mock.calls.some(([url]) => url === "/admin/ai/credits")
const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

beforeEach(() => {
  sdkFetch.mockReset()
  staff.role = "owner"
  staff.read = 0
})

describe("AiCreditCost", () => {
  it("says one operation's price, dearer than one credit, from the wallet's table", async () => {
    show(<AiCreditCost tasks={["image_scene"]} service="platform" />)
    expect(await screen.findByText("40 kredi")).toBeInTheDocument()
  })

  it("says nothing for an operation of one credit", async () => {
    const { container } = show(<AiCreditCost tasks={["seo_title"]} service="platform" />)
    await waitFor(() => {
      expect(askedWallet()).toBe(true)
    })
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it("says a bulk job's price per item and its most, the tasks of an item summed", async () => {
    show(<AiCreditCost tasks={["seo_title", "seo_description"]} service="platform" items={25} />)
    expect(await screen.findByText("Öğe başına 2 kredi; en çok 50 kredi.")).toBeInTheDocument()
  })

  it("says nothing for a task the table does not price", async () => {
    const { container } = show(<AiCreditCost tasks={["image_scene"]} service="platform" />, SEO)
    await waitFor(() => {
      expect(askedWallet()).toBe(true)
    })
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it("reads nothing, not even who is signed in, off the platform", async () => {
    const { container } = show(<AiCreditCost tasks={["image_scene"]} service="photoroom" />)
    await settle()
    expect(container).toBeEmptyDOMElement()
    expect([askedWallet(), staff.read]).toEqual([false, 0])
  })

  it("never asks for the wallet for a role that may not read it", async () => {
    staff.role = "operations"
    const { container } = show(
      <AiCreditCost tasks={["image_scene"]} service="platform" items={3} />
    )
    await settle()
    expect(container).toBeEmptyDOMElement()
    expect(askedWallet()).toBe(false)
  })
})

describe("the price in the picture dialog and the bulk jobs", () => {
  it("says the background's price, then the scene's once that mode is chosen", async () => {
    show(
      <AiBackgroundDialog
        open
        onOpenChange={vi.fn()}
        source={{ id: "media_01", url: "https://cdn.example.com/kupa.webp" }}
        useNote="Ürüne eklenir."
        onUse={vi.fn()}
      />
    )
    expect(await screen.findByText("10 kredi")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("radio", { name: "Sahneye yerleştir" }))
    expect(await screen.findByText("40 kredi")).toBeInTheDocument()
  })

  it("says the alt text job's price per image and for its fifty at most", async () => {
    show(
      <AltReviewStart
        usable={["platform"]}
        service="platform"
        onService={vi.fn()}
        job={undefined}
        starting={false}
        onStart={vi.fn()}
      />
    )
    expect(await screen.findByText("Öğe başına 2 kredi; en çok 100 kredi.")).toBeInTheDocument()
  })

  it("says the search texts' price by what is filled and the pages one job takes", async () => {
    const props = {
      usable: ["platform"],
      service: "platform",
      onService: vi.fn(),
      onScope: vi.fn(),
      count: { pages: 30, title: 12, description: 30, max: 20 },
      job: undefined,
      starting: false,
      onStart: vi.fn(),
    }
    const { rerender } = show(<SeoFillStart {...props} scope="both" />)
    expect(await screen.findByText("Öğe başına 2 kredi; en çok 40 kredi.")).toBeInTheDocument()
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SeoFillStart {...props} scope="title" />
      </QueryClientProvider>
    )
    expect(await screen.findByText("Öğe başına 1 kredi; en çok 12 kredi.")).toBeInTheDocument()
  })
})
