import { DEFAULT_APPEARANCE } from "@qticaret/types"
import type { AppearanceSettings } from "@qticaret/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, renderHook, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { APPEARANCE_KEY, useSaveAppearance } from "@/features/settings/api/appearance"
import { StoreMark } from "./store-mark"
import { useDocumentIcon } from "./use-document-icon"

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

const ICON = "https://cdn.ornek.com/simge.png"
const LOGO = "https://cdn.ornek.com/logo-koyu.png"

/** A button that saves the site icon as the store profile does. */
function SaveIcon({ url }: { url: string }) {
  const save = useSaveAppearance()
  return (
    <button
      type="button"
      onClick={() => {
        save.mutate({ favicon_url: url })
      }}
    >
      save
    </button>
  )
}

function renderMark(appearance: Partial<AppearanceSettings>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const values = { ...DEFAULT_APPEARANCE, ...appearance }
  client.setQueryData(APPEARANCE_KEY, { values, version: 1 })
  client.setQueryData(["settings", "medusa-store"], { id: "store_1", name: "Örnek Bıçak" })
  fetchMock.mockImplementation((_url: string, init?: { body?: Partial<AppearanceSettings> }) =>
    Promise.resolve({ values: { ...values, ...init?.body }, version: 2 })
  )
  const view = render(
    <QueryClientProvider client={client}>
      <StoreMark />
      <SaveIcon url={ICON} />
    </QueryClientProvider>
  )
  return { ...view, picture: () => view.container.querySelector("img") }
}

describe("StoreMark (the shop at the top of the menu)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows the site icon in its square box, beside the shop's name", () => {
    const { picture } = renderMark({ favicon_url: ICON, logo_dark_url: LOGO })

    expect(picture()).toHaveAttribute("src", ICON)
    expect(picture()).toHaveAttribute("alt", "")
    expect(picture()).toHaveClass("size-full", "object-contain")
    // On a tile of the page's surface (a token), so a dark drawing reads on an ink menu
    expect(picture()?.parentElement).toHaveClass(
      "size-8",
      "shrink-0",
      "rounded-md",
      "bg-background",
      "p-1"
    )
    expect(screen.getByText("Örnek Bıçak")).toBeInTheDocument()
  })

  it("without a site icon, shows the logo as before", () => {
    expect(renderMark({ logo_dark_url: LOGO }).picture()).toHaveAttribute("src", LOGO)
  })

  it("without a site icon or a logo, shows the name's initial", () => {
    const { picture } = renderMark({})

    expect(picture()).toBeNull()
    expect(screen.getByText("Ö")).toHaveAttribute("aria-hidden", "true")
  })

  it("keeps the name for screen readers when the menu is folded to icons", () => {
    renderMark({ favicon_url: ICON })

    expect(screen.getByText("Örnek Bıçak").parentElement).toHaveClass(
      "group-data-[collapsible=icon]:sr-only"
    )
  })

  it("shows a site icon at once when the store profile saves one", async () => {
    const { picture } = renderMark({})
    expect(picture()).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "save" }))

    expect(await screen.findByRole("presentation")).toHaveAttribute("src", ICON)
  })
})

describe("useDocumentIcon (the panel's own browser tab)", () => {
  const link = () => document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')

  it("puts the site icon on the tab, follows a new one and takes it off with it", () => {
    const initialProps: { url: string | null } = { url: ICON }
    const { rerender } = renderHook(
      ({ url }) => {
        useDocumentIcon(url)
      },
      { initialProps }
    )

    expect(link()).toHaveAttribute("href", ICON)
    expect(link()).toHaveAttribute("type", "image/png")

    rerender({ url: "https://cdn.ornek.com/simge.svg" })
    expect(document.head.querySelectorAll('link[rel="icon"]')).toHaveLength(1)
    expect(link()).toHaveAttribute("type", "image/svg+xml")

    rerender({ url: null })
    expect(link()).toBeNull()
  })
})
