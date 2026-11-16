import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { fileProblem } from "@/features/media/api/media"
import {
  FAVICON_MAX_BYTES,
  FAVICON_SVG_MAX_BYTES,
  faviconRefusal,
  faviconWarnings,
  isSvgIcon,
} from "@/features/settings/favicon"
import { StoreFaviconField } from "./store-favicon-field"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const ICON = "https://cdn.ornek.com/simge.png"

function renderField(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StoreFaviconField url={url} name="Örnek Bıçak" onChange={vi.fn()} />
    </QueryClientProvider>
  )
}

/** The tab preview's icon, loaded at this size. */
function load(width: number, height: number) {
  const [tab] = screen.getAllByRole("presentation")
  if (!tab) {
    throw new Error("no preview")
  }
  Object.defineProperty(tab, "naturalWidth", { value: width })
  Object.defineProperty(tab, "naturalHeight", { value: height })
  fireEvent.load(tab)
}

describe("the site icon's rules (the server's, said at once)", () => {
  it("takes a PNG within 1 MB and refuses any other type or a heavier one", () => {
    expect(faviconRefusal({ mime_type: "image/png", size: 2048 })).toBeNull()
    expect(faviconRefusal({ mime_type: "image/jpeg", size: 2048 })).toBe(
      "settings.store.brand.favicon.type"
    )
    expect(faviconRefusal({ mime_type: "image/png", size: FAVICON_MAX_BYTES + 1 })).toBe(
      "settings.store.brand.favicon.tooLarge"
    )
    expect(faviconRefusal({ mime_type: "image/png", size: null })).toBe(
      "settings.store.brand.favicon.unmeasured"
    )
  })

  it("warns of a shape that is not square or too small, never refuses it", () => {
    expect(faviconWarnings({ width: 512, height: 512 })).toEqual([])
    expect(faviconWarnings({ width: 512, height: 256 })).toEqual([
      "settings.store.brand.favicon.notSquare",
    ])
    expect(faviconWarnings({ width: 32, height: 32 })).toEqual([
      "settings.store.brand.favicon.small",
    ])
    expect(faviconWarnings(null)).toEqual([])
  })

  it("takes an SVG within 100 KB, square by its box and never too small", () => {
    expect(faviconRefusal({ mime_type: "image/svg+xml", size: FAVICON_SVG_MAX_BYTES })).toBeNull()
    expect(faviconRefusal({ mime_type: "image/svg+xml", size: FAVICON_SVG_MAX_BYTES + 1 })).toBe(
      "settings.store.brand.favicon.tooLarge"
    )
    expect(faviconWarnings({ width: 16, height: 16 }, true)).toEqual([])
    expect(faviconWarnings({ width: 32, height: 16 }, true)).toEqual([
      "settings.store.brand.favicon.notSquare",
    ])
    expect(isSvgIcon("https://cdn.ornek.com/simge.svg?v=2")).toBe(true)
    expect(isSvgIcon(ICON)).toBe(false)
  })

  it("offers an SVG to the logo and site icon pickers only", () => {
    const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" })
    expect(fileProblem(svg)).toBe("type")
    expect(fileProblem(svg, true)).toBeNull()
    expect(
      fileProblem(
        new File([new Uint8Array(201 * 1024)], "big.svg", { type: "image/svg+xml" }),
        true
      )
    ).toBe("svgSize")
  })
})

describe("StoreFaviconField", () => {
  it("says what shows without an icon", () => {
    renderField("")
    expect(screen.getByText("Simge yok")).toBeInTheDocument()
    expect(screen.getByText(/vitrin varsayılan simgeyi gösterir/)).toBeInTheDocument()
  })

  it("previews the icon in a tab beside the shop's name, quiet while it is square", () => {
    renderField(ICON)
    expect(screen.getByText("Örnek Bıçak")).toBeInTheDocument()
    load(512, 512)
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("warns once the loaded icon proves not square", () => {
    renderField(ICON)
    load(600, 300)
    expect(screen.getByRole("status")).toHaveTextContent(/Simge kare değil/)
  })
})
