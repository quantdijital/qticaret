import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { layoutOf } from "@/features/storefront/editor/theme-editor.fixtures"
import { REPORT_KEY } from "./api"
import type { ApplyTarget } from "./api"
import { ApplyDialog } from "./apply-dialog"
import { preset } from "./gallery.fixtures"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))

const FIT = "/admin/storefront-presets/cutlery/tezgah/fit"
const APPLY = "/admin/storefront-presets/cutlery/tezgah/apply"

// Another sector's look, with menus: a bıçak look in a travel shop (owner, 2026-11-28)
const tezgah = (): ApplyTarget => ({
  kind: "preset",
  preset: preset("tezgah", {
    pack: "cutlery",
    name: "Tezgâh",
    sector: { code: "cutlery", name: "Bıçak ve çatal-bıçak" },
    own: false,
    has_menus: true,
  }),
})

function open(target: ApplyTarget) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ApplyDialog
        target={target}
        onClose={vi.fn()}
        draftChanged={false}
        pendingMenus
        savedFull={false}
        savedLimit={10}
        currentName="Vadi"
      />
    </QueryClientProvider>
  )
  return { client }
}

const lines = () =>
  within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .map((each) => each.textContent)

const answer = { layout: layoutOf(), result: { auto_saved: null, skipped: [], kept: [] } }

describe("ApplyDialog for another sector's look (owner, 2026-11-28)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
  })

  it("says whom the look was made for and takes its style alone by default", async () => {
    fetchMock.mockResolvedValue(answer)
    const user = userEvent.setup()
    const { client } = open(tezgah())

    expect(
      screen.getByText("Bu görünüm Bıçak ve çatal-bıçak mağazası için hazırlandı.")
    ).toBeVisible()
    expect(screen.getByRole("radio", { name: "Yalnız stilini al" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Yalnız stilini al" })).toHaveAccessibleDescription(
      "Renkler, yazı tipleri, köşeler, kart biçimi ve stil takımı taslağa gelir; bölümleriniz olduğu gibi kalır."
    )
    // Its menus never come with its style alone, nor a menu change waiting in the draft lost
    expect(screen.queryByText(/Bu görünüm menü de içerir/)).toBeNull()
    expect(lines()).toEqual([
      expect.stringMatching(/^Vitrin hemen değişmez/),
      expect.stringMatching(/otomatik kaydedilir\.$/),
      "Yalnız stil değişir: bölümleriniz, üst ve alt bilginiz olduğu gibi kalır.",
      "Menülerinize dokunulmaz.",
      expect.stringMatching(/^Güven rozetleri/),
    ])
    // The fit is read only for the whole look
    expect(fetchMock).not.toHaveBeenCalledWith(FIT)

    await user.click(screen.getByRole("button", { name: "Taslağa uygula ve düzenle" }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/storefront/editor" })
    })
    expect(fetchMock).toHaveBeenCalledWith(APPLY, { method: "POST", body: { scope: "style" } })
    expect(client.getQueryData(REPORT_KEY)).toMatchObject({ name: "Tezgâh", scope: "style" })
  })

  it("lists, before applying it whole, the sections this shop has nothing for", async () => {
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === FIT
          ? {
              unfit: [
                {
                  where: "home.kullanimagore",
                  type: "categories",
                  title: "Kullanıma göre",
                  refs: ["category:cakilar"],
                  reason: "missing",
                },
                {
                  where: "home.yakinplan",
                  type: "featured_product",
                  title: null,
                  refs: ["product:alageyik"],
                  reason: "missing",
                },
              ],
            }
          : answer
      )
    )
    const user = userEvent.setup()
    const { client } = open(tezgah())

    await user.click(screen.getByRole("radio", { name: "Düzeniyle birlikte al" }))
    expect(
      await screen.findByText(/^2 bölüm bu mağazada karşılığı olmadığı için eklenmeyecek: /)
    ).toHaveTextContent(/Kullanıma göre, \S/)
    // Whole, its menus come too: said as for the shop's own looks
    expect(screen.getByText(/Bu görünüm menü de içerir/)).toBeVisible()
    expect(lines()).toContain("Taslakta yayınlanmayı bekleyen menü değişikliği var; kayda alınmaz.")

    await user.click(screen.getByRole("button", { name: "Taslağa uygula ve düzenle" }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalled()
    })
    expect(fetchMock).toHaveBeenCalledWith(APPLY, { method: "POST", body: {} })
    expect(client.getQueryData(REPORT_KEY)).not.toHaveProperty("scope")
  })

  it("says so when every section fits", async () => {
    fetchMock.mockResolvedValue({ unfit: [] })
    const user = userEvent.setup()
    open(tezgah())

    await user.click(screen.getByRole("radio", { name: "Düzeniyle birlikte al" }))
    expect(await screen.findByText("Bütün bölümlerin bu mağazada karşılığı var.")).toBeVisible()
  })

  it("offers no choice for the shop's own sector's look", () => {
    open({ kind: "preset", preset: preset("vadi", { pack: "travel", own: true }) })

    expect(screen.queryByRole("radio")).toBeNull()
    expect(screen.queryByText(/mağazası için hazırlandı/)).toBeNull()
  })
})
