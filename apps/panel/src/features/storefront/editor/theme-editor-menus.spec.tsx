import { screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MenuInput } from "@/features/storefront/api/menus"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import {
  DOC,
  holdClock,
  lastSaved,
  layoutOf,
  opened,
  pass,
  postsTo,
  releaseClock,
  renderEditor,
  serve,
} from "./theme-editor.fixtures"
import type { AdminMock, Init } from "./theme-editor.fixtures"

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

const RESTORE = "/admin/storefront-layout/revisions/2/restore"
const PUBLISH = "/admin/storefront-layout/publish"
const HEAVY = { timeout: 15_000 }

const menu = (title: string, location: MenuInput["location"], rank: number): MenuInput => ({
  title,
  location,
  rank,
  items: [{ link: { kind: "system", target: "shop", label: null }, children: [] }],
})
const MENUS = [menu("Ana menü", "main", 0), menu("Kurumsal", "footer", 1)]

/** The design with a second revision that put a menu set live (adr/0063 §3). */
const withMenusRevision = () =>
  layoutOf({
    revision: 2,
    revisions: [
      {
        revision: 2,
        published_at: "2026-11-02T09:00:00.000Z",
        published_by: null,
        has_menus: true,
      },
      {
        revision: 1,
        published_at: "2026-11-01T09:00:00.000Z",
        published_by: null,
        has_menus: false,
      },
    ],
  })

let user: UserEvent

async function askToRestore() {
  serve(fetchMock, admin, withMenusRevision())
  renderEditor()
  await opened()
  await user.click(screen.getByRole("button", { name: "Görünümler" }))
  await user.click(await screen.findByRole("menuitem", { name: "Yayın geçmişi" }))
  const sheet = await screen.findByRole("dialog", { name: "Yayın geçmişi" })
  // Only the version that put menus live says so
  const badges = within(sheet).getAllByText("Menülerle")
  expect(badges).toHaveLength(1)
  expect(badges[0]?.closest("li")).toHaveTextContent("2. yayın")
  await user.click(within(sheet).getByRole("button", { name: "2. yayını taslağa geri yükle" }))
  return screen.findByRole("alertdialog", { name: "2. yayın taslağa yüklensin mi?" })
}

describe("menus in the design's draft (adr/0063 §3)", HEAVY, () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
  })
  afterEach(() => {
    releaseClock()
  })

  it("asks before a version that put menus live comes back, menus and all by default", async () => {
    // The draft has no changes: a version without menus would load at once
    const confirm = await askToRestore()
    expect(confirm).toHaveTextContent(/menüleri de değiştirmişti/)
    expect(confirm).toHaveTextContent(/Vitrin, siz yayınlayana kadar değişmez/)
    const skip = within(confirm).getByRole("checkbox", { name: /Menüleri alma/ })
    expect(skip).not.toBeChecked()
    await user.click(within(confirm).getByRole("button", { name: "Taslağa yükle" }))

    await waitFor(() => {
      expect(postsTo(fetchMock, RESTORE).map(([, init]) => init?.body)).toEqual([{ menus: true }])
    })
  })

  it("leaves the version's menus out when asked", async () => {
    const confirm = await askToRestore()
    await user.click(within(confirm).getByRole("checkbox", { name: /Menüleri alma/ }))
    await user.click(within(confirm).getByRole("button", { name: "Taslağa yükle" }))

    await waitFor(() => {
      expect(postsTo(fetchMock, RESTORE).map(([, init]) => init?.body)).toEqual([{ menus: false }])
    })
  })

  it("says the draft would replace the shop's menus, and drops the set when asked", async () => {
    const draft = { ...DOC, settings: { ...DOC.settings, menus: MENUS } }
    serve(fetchMock, admin, layoutOf({ draft, has_changes: true }))
    renderEditor()
    await opened()
    const notice = screen.getByText(/2 menüsü var: Yayınla'ya bastığınızda/)
    expect(notice).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Menüleri bırak" }))
    expect(screen.queryByText(/menüsü var/)).toBeNull()
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.settings.menus).toBeNull()
    })
    // The rest of the draft is as it was
    expect(lastSaved(fetchMock)?.home).toEqual(DOC.home)

    // One undo brings the set back, as any change to the design
    await user.click(screen.getByRole("button", { name: "Geri al" }))
    expect(screen.getByText(/2 menüsü var/)).toBeVisible()
  })

  it("reloads the draft once published, so the set put live is not saved back", async () => {
    const draft = { ...DOC, settings: { ...DOC.settings, menus: MENUS } }
    serve(fetchMock, admin, layoutOf({ draft, has_changes: true }))
    renderEditor()
    await opened()
    expect(screen.getByText(/2 menüsü var/)).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Yayınla" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Tasarım yayınlansın mı?" })
    await user.click(within(dialog).getByRole("button", { name: "Yayınla" }))
    await waitFor(() => {
      expect(postsTo(fetchMock, PUBLISH)).toHaveLength(1)
    })
    await waitFor(() => {
      expect(screen.queryByText(/menüsü var/)).toBeNull()
    })

    // A later change saves a draft without the set: the next publish leaves the menus alone
    await user.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.home[0]).toMatchObject({ visible: false })
    })
    expect(lastSaved(fetchMock)?.settings.menus).toBeNull()
  })
})
