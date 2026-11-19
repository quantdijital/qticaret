import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ContentDetail } from "@/features/content/api/content"
import { CONTENT_PAGES, PAGE_LAYOUTS } from "@/features/storefront/editor/content-pages.fixtures"
import { DOC, layoutOf } from "@/features/storefront/editor/theme-editor.fixtures"
import { ContentActions } from "./content-actions"
import { EntryList } from "./entry-list"

const fetchMock = vi.hoisted(() => vi.fn<(url: string) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    search,
    children,
  }: {
    to: string
    params?: { id: string }
    search?: Record<string, string>
    children: ReactNode
  }) => {
    const path = params ? to.replace("$id", params.id) : to
    const query = search ? `?${new URLSearchParams(search).toString()}` : ""
    return <a href={`${path}${query}`}>{children}</a>
  },
  useNavigate: () => vi.fn(),
}))

function show(element: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>)
}

const detail = (index: number, kind: "page" | "post" = "page"): ContentDetail => ({
  ...(CONTENT_PAGES[index] as ContentDetail),
  kind,
  body: { type: "doc", content: [] },
  image_alt: null,
})

/** İçerik's side of a content page's own layout (adr/0073 §5). */
describe("a content page and the theme editor", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string) => {
      if (url === "/admin/content") {
        return Promise.resolve({ entries: CONTENT_PAGES, count: CONTENT_PAGES.length })
      }
      if (url === "/admin/storefront-layout") {
        return Promise.resolve({ layout: layoutOf({ draft: { ...DOC, pages: PAGE_LAYOUTS } }) })
      }
      return Promise.reject(new Error(`unexpected ${url}`))
    })
  })

  it("opens the editor on the page from its screen; a post has no layout of its own", () => {
    const { unmount } = show(<ContentActions entry={detail(2)} />)
    expect(screen.getByRole("link", { name: "Tema düzenleyicide tasarla" })).toHaveAttribute(
      "href",
      "/storefront/editor?icerik=cnt_iade"
    )
    unmount()

    show(<ContentActions entry={detail(0, "post")} />)
    expect(screen.queryByRole("link", { name: "Tema düzenleyicide tasarla" })).toBeNull()
  })

  it("marks the pages with a layout of their own in the list", async () => {
    show(<EntryList kind="page" q="" page={0} onPage={vi.fn()} add={null} />)
    const row = (title: string) =>
      screen.getByRole("link", { name: title }).closest("tr") as HTMLElement

    expect(await screen.findByRole("link", { name: "Hakkımızda" })).toBeVisible()
    expect(
      await within(row("Hakkımızda")).findByRole("img", { name: "Kendi düzeni var" })
    ).toBeTruthy()
    expect(within(row("İletişim")).getByRole("img", { name: "Kendi düzeni var" })).toBeTruthy()
    expect(
      within(row("İade koşulları")).queryByRole("img", { name: "Kendi düzeni var" })
    ).toBeNull()
  })
})
