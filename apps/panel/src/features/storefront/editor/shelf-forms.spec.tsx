import { screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import {
  holdClock,
  lastSaved,
  opened,
  pass,
  releaseClock,
  renderEditor,
  serve,
} from "./theme-editor.fixtures"
import type { AdminMock, Init } from "./theme-editor.fixtures"
import { openGroup, openTab } from "./settings-groups.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const admin = vi.hoisted<AdminMock>(() => ({
  productCategory: { list: vi.fn() },
  product: { list: vi.fn() },
  productCollection: { list: vi.fn() },
}))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useRouter: () => ({ history: { back: vi.fn() } }),
  useCanGoBack: () => true,
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
}))

// Each test types and picks through the whole editor, which draws itself anew
// on every key: CPU work a full run's load can stretch past the default 5 s.
// Nothing waits on the wall clock (holdClock), so this bounds work, not waiting
const HEAVY = { timeout: 15_000 }

let user: UserEvent

/** Opens a section's settings from its row in the tree: the panel's title. */
async function open(name: string) {
  const tree = await opened()
  await user.click(within(tree).getByRole("button", { name }))
  return within(await screen.findByRole("region")).getByRole("heading", { level: 2 })
}

/** The draft once the autosave has sent it with `check` holding; its pause is not waited out. */
async function saved(check: (doc: LayoutDocument) => void) {
  await pass(AUTOSAVE_MS)
  await waitFor(() => {
    const doc = lastSaved(fetchMock)
    expect(doc).toBeDefined()
    if (doc) check(doc)
  })
}

describe("a product list's layout and scrolling (adr/0049 Ek 2026-11-15)", HEAVY, () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    serve(fetchMock, admin)
    renderEditor()
  })
  afterEach(() => {
    releaseClock()
  })

  it("picks a carousel in Stil › Diziliş, offers Kaydırma with its arrows, and saves the kit's steps", async () => {
    await open("Ürün listesi")
    // The variant sits in "Diziliş" (closed at first), not in a group of its own
    await openTab(user, "style")
    expect(screen.getByRole("button", { name: "Diziliş" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(screen.queryByRole("button", { name: "Kaydırma" })).toBeNull()

    await openGroup(user, "Diziliş")
    await user.click(screen.getByRole("radio", { name: /Kayan sıra/ }))
    expect(screen.getByRole("button", { name: "Kaydırma" })).toBeVisible()
    await openGroup(user, "Kaydırma")
    // The grid's own cards in a row go with it
    expect(screen.queryByRole("radio", { name: "Satırda 3 ürün" })).toBeNull()
    await user.click(screen.getByRole("radio", { name: "Üzerine gelince" }))
    await saved((doc) => {
      expect(doc.home[1]).toMatchObject({
        type: "products",
        variant: "carousel",
        scroller: { arrows: "hover", desktop: "four", autoplay: "off" },
      })
      expect(doc.home[1]).not.toHaveProperty("columns")
    })

    // Hidden arrows take their look and place with them
    await user.click(screen.getByRole("radio", { name: "Gizli" }))
    expect(screen.queryByText("Ok biçimi")).toBeNull()
  })

  it("adds a second list to a columns layout, each with its own title and source", async () => {
    await open("Ürün listesi")
    await openGroup(user, "Diziliş")
    await user.click(screen.getByRole("radio", { name: /Yan yana listeler/ }))
    expect(screen.getByText(/her zaman kompakt/)).toBeVisible()
    expect(screen.queryByRole("combobox", { name: "Kart biçimi" })).toBeNull()
    // The lists are the content, how many each shows its layout
    await openTab(user, "content")
    await user.click(screen.getByRole("button", { name: "Liste ekle" }))
    expect(screen.queryByRole("button", { name: "Liste ekle" })).toBeNull()
    await openTab(user, "style")
    await user.click(screen.getByRole("radio", { name: "4 ürün" }))
    await saved((doc) => {
      expect(doc.home[1]).toMatchObject({
        variant: "columns",
        per_list: 4,
        lists: [
          { title: null, source: { kind: "newest" } },
          { title: null, source: { kind: "newest" } },
        ],
      })
    })
  })
})
