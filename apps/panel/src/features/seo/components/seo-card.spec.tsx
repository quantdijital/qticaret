import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SeoCard } from "./seo-card"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))

const EMPTY = {
  seo_title: null,
  seo_description: null,
  focus_keyword: null,
  canonical_override: null,
  robots_override: null,
  og_image_override: null,
  og_image_alt: null,
}

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(["seo-meta", "page", "cent_1"], EMPTY)
  render(
    <QueryClientProvider client={client}>
      <SeoCard
        type="page"
        id="cent_1"
        context={{ path: "/hakkimizda", tokens: { başlık: "Hakkımızda" }, fallbackDescription: "" }}
      />
    </QueryClientProvider>
  )
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement

/** The owner, 2026-11-04: the SEO fields are all optional and a save is never refused for length. */
describe("SeoCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.startsWith("/admin/seo/")
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
})
