import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PartMark } from "@/features/products/detail/use-product-findings"
import { PartNav } from "./part-nav"
import type { PartKey } from "./parts"

type Watch = (entries: { target: Element; isIntersecting: boolean }[]) => void
let watch: Watch = () => undefined

const MARKS: Partial<Record<PartKey, PartMark>> = {
  general: "complete",
  seo: "missing",
  attributes: "urgent",
}

/** The page's parts as `PartSlot` draws them; the FAQ draws nothing here. */
function Page({ wide = true, onGo = vi.fn() }: { wide?: boolean; onGo?: (key: PartKey) => void }) {
  return (
    <main>
      <PartNav
        parts={["general", "seo", "attributes", "faq"]}
        marks={(key) => MARKS[key] ?? null}
        wide={wide}
        onGo={onGo}
      />
      <div data-part="general" style={{ display: "contents" }}>
        <div id="product-general">general</div>
      </div>
      <div data-part="seo" style={{ display: "contents" }}>
        <section id="product-seo">seo</section>
      </div>
      <div data-part="attributes" style={{ display: "contents" }}>
        <section id="product-attributes">attributes</section>
      </div>
      <div data-part="faq" style={{ display: "contents" }} />
    </main>
  )
}

beforeEach(() => {
  // jsdom lays nothing out: every element counts as drawn
  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList)
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: Watch) {
        watch = callback
      }
      observe() {
        return undefined
      }
      disconnect() {
        return undefined
      }
    }
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("PartNav (docs/06 'Ürün sayfası')", () => {
  it("names the parts drawn, in order, each with its mark; a part drawing nothing is left out", async () => {
    render(<Page />)
    const nav = screen.getByRole("navigation", { name: "Sayfanın bölümleri" })
    expect(nav).toBeInTheDocument()
    await screen.findByRole("button", { name: "Genel bilgiler tamam" })
    const names = screen.getAllByRole("button").map((button) => button.textContent)
    expect(names).toEqual([
      "Genel bilgiler tamam",
      "Arama motoru görünümü eksik var",
      "Özellikler ilgilenilmeli",
    ])
  })

  it("goes to a part on a click and marks the one being read", async () => {
    const onGo = vi.fn()
    render(<Page onGo={onGo} />)
    const seo = await screen.findByRole("button", { name: "Arama motoru görünümü eksik var" })
    await userEvent.click(seo)
    expect(onGo).toHaveBeenCalledWith("seo")

    const attributes = screen.getByRole("button", { name: "Özellikler ilgilenilmeli" })
    act(() => {
      watch([
        { target: document.getElementById("product-attributes") as Element, isIntersecting: true },
      ])
    })
    // The click's own mark gives way to the scroll's after a moment
    await vi.waitFor(
      () => {
        expect(attributes).toHaveAttribute("aria-current", "location")
      },
      { timeout: 1500 }
    )
    expect(seo).not.toHaveAttribute("aria-current")
  })

  it("is one picker on a narrow screen, never a row that scrolls sideways", async () => {
    render(<Page wide={false} />)
    expect(await screen.findByRole("combobox", { name: "Sayfanın bölümleri" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Genel bilgiler/ })).toBeNull()
  })
})
