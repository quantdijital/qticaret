import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { Author } from "@/features/content/api/authors"
import { AuthorDialog } from "./author-dialog"
import { AuthorList } from "./author-list"

interface Init {
  method?: string
  body?: unknown
  query?: Record<string, unknown>
}

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }))

const author = (more: Partial<Author>): Author => ({
  id: "cauth_1",
  name: "Ayşe Usta",
  handle: "ayse-usta",
  path: "/blog/yazar/ayse-usta",
  job_title: "Bıçak ustası",
  bio: "Yirmi yıldır bıçak biliyor.",
  image_url: null,
  website_url: null,
  linkedin_url: "https://www.linkedin.com/in/ayse",
  instagram_url: null,
  x_url: null,
  user_id: null,
  user: null,
  post_count: 3,
  live_post_count: 2,
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T09:00:00Z",
  ...more,
})

const AYSE = author({})
const MEHMET = author({
  id: "cauth_2",
  name: "Mehmet Şef",
  handle: "mehmet-sef",
  path: "/blog/yazar/mehmet-sef",
  job_title: null,
  bio: null,
  linkedin_url: null,
  post_count: 0,
  live_post_count: 0,
})

function serve() {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/content/authors" && init?.method === "POST") {
      const body = init.body as { name: string }
      return Promise.resolve({ author: author({ id: "cauth_9", name: body.name }) })
    }
    if (url === "/admin/content/authors") {
      return Promise.resolve({ authors: [AYSE, MEHMET], count: 2 })
    }
    if (url === "/admin/content/authors/cauth_1" && init?.method === "POST") {
      return Promise.resolve({ author: { ...AYSE, ...(init.body as object) } })
    }
    if (url === "/admin/content/authors/cauth_1" && init?.method === "DELETE") {
      return Promise.resolve({ id: "cauth_1", deleted: true, unlinked: 3 })
    }
    if (url === "/admin/staff") {
      return Promise.resolve({
        staff: [
          {
            id: "user_1",
            email: "ayse@example.com",
            first_name: "Ayşe",
            last_name: "Yılmaz",
            created_at: "2026-10-01T09:00:00Z",
            role: "admin",
            you: false,
            mfa: true,
          },
        ],
        invites: null,
      })
    }
    return Promise.reject(Object.assign(new Error(`unexpected ${url}`), { status: 404 }))
  })
}

const calls = (url: string, method: string) =>
  fetchMock.mock.calls.filter(([to, init]) => to === url && init?.method === method)

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

function renderList() {
  return render(
    <QueryClientProvider client={client()}>
      <AuthorList q="" page={0} onPage={vi.fn()} add={null} />
    </QueryClientProvider>
  )
}

describe("blog authors", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toastSuccess.mockReset()
    serve()
  })

  it("lists them by name with their page's address, title and post counts", async () => {
    renderList()
    await screen.findByRole("button", { name: "Mehmet Şef" })
    const rows = screen.getAllByRole("row").slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      "AAyşe Usta/blog/yazar/ayse-ustaBıçak ustası32 yayında",
      "MMehmet Şef/blog/yazar/mehmet-sef—00 yayında",
    ])
  })

  it("opens an author in the standard dialog and saves only what changed", async () => {
    renderList()
    await userEvent.click(await screen.findByRole("button", { name: "Ayşe Usta" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("/blog/yazar/ayse-usta")).toBeInTheDocument()
    expect(within(dialog).getByRole("textbox", { name: /Biyografi/ })).toHaveValue(AYSE.bio)
    expect(within(dialog).getByRole("textbox", { name: "LinkedIn" })).toHaveValue(AYSE.linkedin_url)
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Unvan" }))
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Unvan" }), "Usta bileyici")
    await userEvent.type(within(dialog).getByRole("textbox", { name: "X" }), "https://x.com/ayse")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(calls("/admin/content/authors/cauth_1", "POST")).toEqual([
        [
          "/admin/content/authors/cauth_1",
          {
            method: "POST",
            body: { job_title: "Usta bileyici", x_url: "https://x.com/ayse" },
          },
        ],
      ])
    })
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("links the author to a staff account", async () => {
    renderList()
    await userEvent.click(await screen.findByRole("button", { name: "Ayşe Usta" }))
    const dialog = await screen.findByRole("dialog")
    const select = within(dialog).getByRole("combobox", { name: "Personel hesabı" })
    expect(select).toHaveTextContent("Bağlı personel hesabı yok")
    await userEvent.click(select)
    await userEvent.click(await screen.findByRole("option", { name: "Ayşe Yılmaz" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(calls("/admin/content/authors/cauth_1", "POST")).toEqual([
        ["/admin/content/authors/cauth_1", { method: "POST", body: { user_id: "user_1" } }],
      ])
    })
  })

  it("deletes an author after saying their posts stay, without an author", async () => {
    renderList()
    await userEvent.click(await screen.findByRole("button", { name: "Ayşe Usta" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Yazarı sil" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(confirm).toHaveTextContent("Yazarın 3 yazısı silinmez, yazarsız kalır.")
    await userEvent.click(within(confirm).getByRole("button", { name: "Yazarı sil" }))
    await waitFor(() => {
      expect(calls("/admin/content/authors/cauth_1", "DELETE")).toHaveLength(1)
    })
    expect(toastSuccess).toHaveBeenCalledWith("Yazar silindi. 3 yazı yazarsız kaldı.")
  })

  it("makes a new author, the address from the name unless typed", async () => {
    const onSaved = vi.fn()
    render(
      <QueryClientProvider client={client()}>
        <AuthorDialog author={null} onClose={vi.fn()} onSaved={onSaved} />
      </QueryClientProvider>
    )
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("button", { name: "Kaydet" })).toBeDisabled()
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Ad soyad/ }), "Zeynep Kaya")
    expect(
      within(dialog).getByRole("textbox", { name: /Yazar sayfasının adresi/ })
    ).toHaveAttribute("placeholder", "zeynep-kaya")
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Unvan" }), "Mutfak şefi")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(calls("/admin/content/authors", "POST")).toEqual([
        [
          "/admin/content/authors",
          { method: "POST", body: { name: "Zeynep Kaya", job_title: "Mutfak şefi" } },
        ],
      ])
    })
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "cauth_9" }))
  })

  it("asks for a name before making an author", async () => {
    render(
      <QueryClientProvider client={client()}>
        <AuthorDialog author={null} onClose={vi.fn()} />
      </QueryClientProvider>
    )
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Unvan" }), "Şef")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    expect(await within(dialog).findByText("Yazarın adını yazın.")).toBeInTheDocument()
    expect(calls("/admin/content/authors", "POST")).toEqual([])
  })
})
