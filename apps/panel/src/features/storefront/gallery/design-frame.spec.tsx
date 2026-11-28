import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { DesignCard } from "./design-card"
import { pictureAddress } from "./design-preview"
import { design } from "./gallery.fixtures"

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const TOKEN = `sfd_1.abc.${"m".repeat(43)}`
const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()
const link = (expires_at = inAnHour()) => ({
  url: `https://magaza.example/onizleme/${TOKEN}`,
  path: `/onizleme/${TOKEN}`,
  expires_at,
})

// The card's room: a laptop page scaled down to it
function roomOf(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(height)
}

// An observer the test tells when the card comes near the screen
let reveal: (() => void) | null = null
class Watcher {
  constructor(private readonly seen: (entries: { isIntersecting: boolean }[]) => void) {}
  observe() {
    reveal = () => {
      this.seen([{ isIntersecting: true }])
    }
  }
  disconnect() {
    reveal = null
  }
}

function card() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <DesignCard design={design("sfd_1")} savedFull={false} busy={false} onApply={vi.fn()} />
    </QueryClientProvider>
  )
  return screen.getByRole("article", { name: "Bayram vitrini" })
}

const frameOf = (article: HTMLElement) => article.querySelector("iframe")

describe("a saved look's picture (adr/0064)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(link())
    vi.stubGlobal("IntersectionObserver", Watcher)
    roomOf(320, 200)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("asks for nothing until the card comes near the screen", async () => {
    const article = card()
    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(frameOf(article)).toBeNull()
    // The sketch stands meanwhile
    expect(article.querySelector("[data-design-thumb]")).not.toBeNull()
  })

  it("frames the storefront's page with the look, a picture alone: no script, no focus", async () => {
    const article = card()
    reveal?.()
    await waitFor(() => {
      expect(frameOf(article)).not.toBeNull()
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/storefront-designs/sfd_1/preview")
    const frame = frameOf(article)
    if (!frame) {
      throw new Error("no frame")
    }
    expect(frame.getAttribute("src")).toMatch(new RegExp(`/onizleme/${TOKEN}\\?gorsel=1$`))
    expect(frame.getAttribute("sandbox")).toBe("allow-same-origin")
    expect(frame).toHaveAttribute("aria-hidden", "true")
    expect(frame).toHaveAttribute("tabindex", "-1")
    expect(frame).toHaveAttribute("loading", "lazy")
    // A laptop's page scaled to the card's width
    expect(frame.style.width).toBe("1280px")
    expect(frame.style.transform).toBe("scale(0.25)")
    // Shown once it has loaded, over the sketch
    expect(frame.style.opacity).toBe("0")
    fireEvent.load(frame)
    expect(frame.style.opacity).toBe("1")
  })

  it("keeps the sketch when no link comes", async () => {
    fetchMock.mockRejectedValue(new Error("nope"))
    const article = card()
    reveal?.()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(frameOf(article)).toBeNull()
    expect(article.querySelector("[data-design-thumb]")).not.toBeNull()
  })

  it("never frames a link about to end", () => {
    const now = Date.parse("2026-11-28T10:00:00Z")
    expect(pictureAddress(link("2026-11-28T10:00:30Z"), now)).toBeNull()
    expect(pictureAddress(link("2026-11-28T11:00:00Z"), now)).toMatch(/\?gorsel=1$/)
  })

  it("opens the look whole in a new tab from a fresh link", async () => {
    const user = userEvent.setup()
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() }
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window)
    const article = card()
    await user.click(
      within(article).getByRole("button", {
        name: "‘Bayram vitrini’ görünümünü yeni sekmede önizle",
      })
    )
    expect(open).toHaveBeenCalledWith("about:blank", "_blank")
    await waitFor(() => {
      expect(tab.location.href).toMatch(new RegExp(`/onizleme/${TOKEN}$`))
    })
    // The tab cannot reach back into the panel
    expect(tab.opener).toBeNull()
  })
})
